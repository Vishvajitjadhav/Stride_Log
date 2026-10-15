// HR / Admin: add a person with role (and optionally a project) pre-set.
//   method 'password': create the account with a temporary password
//     and return it once, so the admin can hand it over. No email needed.
//     The person must choose their own password at first sign in.
//   method 'email' (default, for older clients): send Supabase's "invite" auth email
//     (supabase/templates/invite.html); the link lands on /reset-password.
import { createClient } from 'npm:@supabase/supabase-js@2'

const ROLES = ['employee', 'ba', 'manager', 'hr', 'admin']
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
// Easy to read aloud or type: no 0/O, 1/l/I. Three groups of four.
function tempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const raw = [...bytes].map(b => chars[b % chars.length]).join('')
  // Guarantee an upper case letter, a lower case letter and a digit.
  const fixed = 'K' + raw.slice(1, 5) + 'm' + raw.slice(6, 10) + '7' + raw.slice(11)
  return `${fixed.slice(0, 4)}-${fixed.slice(4, 8)}-${fixed.slice(8, 12)}`
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Who is calling?
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return json({ error: 'Not signed in' }, 401)
  const { data: caller } = await admin.from('profiles').select('role, is_approved, is_active').eq('id', user.id).single()
  if (!caller?.is_approved || !caller.is_active || !['hr', 'admin'].includes(caller.role)) {
    return json({ error: 'Only HR or an admin can invite people' }, 403)
  }

  const { email, name, role = 'employee', project_id = null, redirectTo, method = 'email' } = await req.json().catch(() => ({}))
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'A valid email is required' }, 400)
  if (!name?.trim()) return json({ error: 'Name is required' }, 400)
  if (!ROLES.includes(role)) return json({ error: 'Unknown role' }, 400)
  if (role === 'admin' && caller.role !== 'admin') return json({ error: 'Only an admin can invite admins' }, 403)

  const address = email.trim().toLowerCase()
  const password = method === 'password' ? tempPassword() : null
  const { data: invited, error } = password
    ? await admin.auth.admin.createUser({ email: address, password, email_confirm: true, user_metadata: { name: name.trim() } })
    : await admin.auth.admin.inviteUserByEmail(address, { data: { name: name.trim() }, redirectTo })
  if (error) {
    const msg = /already been registered|already exists/i.test(error.message) ? 'That email already has an account.' : error.message
    return json({ error: msg }, 400)
  }

  // Profile row was created by the handle_new_user trigger — pre-approve it.
  const { error: upErr } = await admin.from('profiles').update({
    name: name.trim(),
    role,
    is_approved: true,
    must_change_password: Boolean(password),
  }).eq('id', invited.user.id)
  if (upErr) {
    // Don't leave a half created account behind.
    await admin.auth.admin.deleteUser(invited.user.id)
    return json({ error: upErr.message }, 500)
  }

  if (project_id) {
    await admin.from('project_members').insert({ project_id, user_id: invited.user.id, role: role === 'manager' ? 'manager' : 'member' })
  }

  // The temporary password is returned once, only to the admin who created it.
  return json({ ok: true, id: invited.user.id, email: address, temp_password: password })
})
