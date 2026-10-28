// Called by the database (pg_net) whenever a notification row is inserted.
// Renders the matching email template and sends it. Auth: shared secret
// header (EMAIL_WEBHOOK_SECRET), not a user JWT.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { renderEmail, sendEmail, inlineLogo, type Org } from '../_shared/email.ts'

const fmtDate = (iso?: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '0%')
const STATUS: Record<string, string> = { pending: 'To do', in_progress: 'In progress', in_review: 'In review', done: 'Done', blocked: 'Blocked' }

type Notification = {
  id: string; user_id: string; type: string; title: string; body: string | null
  link: string | null; payload: Record<string, any>; emailed_at: string | null
}

function build(n: Notification, name: string, org: Org) {
  const first = name.split(' ')[0]
  const p = n.payload ?? {}
  switch (n.type) {
    case 'task_assigned':
      return {
        subject: `New task from ${p.actor}: ${n.body}`,
        ...renderEmail({
          org, preheader: `${p.actor} assigned you “${n.body}”`,
          heading: `${p.actor} assigned you a task`,
          paragraphs: [`Hi ${first}, a new task is waiting in your daily list.`],
          rows: [
            ['Task', n.body ?? ''],
            ...(p.date ? [['Planned for', fmtDate(p.date)] as [string, string]] : []),
            ...(p.due_date ? [['Due', fmtDate(p.due_date)] as [string, string]] : []),
            ...(p.priority && p.priority !== 'normal' ? [['Priority', p.priority] as [string, string]] : []),
          ],
          list: p.description ? [p.description] : undefined,
          cta: { label: 'Open My Day', path: n.link ?? '/today' },
        }),
      }
    case 'task_updated':
      return {
        subject: `${p.actor} updated “${n.body}”`,
        ...renderEmail({
          org, preheader: `${p.actor} made changes to one of your tasks`,
          heading: `${p.actor} updated your task`,
          paragraphs: [`Hi ${first}, “${n.body}” was changed.`],
          rows: [
            ['Status', p.old_status && p.old_status !== p.status ? `${STATUS[p.old_status]} to ${STATUS[p.status]}` : STATUS[p.status] ?? ''],
            ...(p.due_date ? [['Due', fmtDate(p.due_date)] as [string, string]] : []),
          ],
          cta: { label: 'View task', path: n.link ?? '/today' },
        }),
      }
    case 'account_approved':
      return {
        subject: `You're approved. Welcome aboard, ${first}`,
        ...renderEmail({
          org, preheader: 'Your account was approved.',
          heading: `Welcome aboard, ${first}!`,
          paragraphs: [
            'Your account has been approved. Each day, add what you’re working on, tick things off, and submit your day in under a minute.',
            'Tip: open the app on your phone and choose “Add to Home Screen” to install it.',
          ],
          cta: { label: 'Start my day', path: '/today' },
          footer: 'You received this because an admin approved your account.',
        }),
      }
    case 'log_reminder':
      return {
        subject: 'Reminder: submit today’s log',
        ...renderEmail({
          org, preheader: 'Take a minute to wrap up your day.',
          heading: `Wrap up your day, ${first}`,
          paragraphs: ['You haven’t submitted today’s log yet. Update your task statuses and press Submit. It takes a minute.'],
          cta: { label: 'Open My Day', path: '/today' },
        }),
      }
    case 'weekly_summary': {
      const s = p as Record<string, any>
      return {
        subject: `Weekly summary, ${fmtDate(s.from)} to ${fmtDate(s.to)}`,
        ...renderEmail({
          org, preheader: `${s.done} of ${s.planned} tasks completed last week`,
          heading: 'Last week at a glance',
          paragraphs: [`Hi ${first}, here’s how the team did from ${fmtDate(s.from)} to ${fmtDate(s.to)}.`],
          rows: [
            ['Tasks completed', `${s.done} of ${s.planned} (${pct(s.done, s.planned)})`],
            ['Daily logs submitted', `${s.submitted_logs} of ${s.expected_logs} (${pct(s.submitted_logs, s.expected_logs)})`],
            ['Blocked tasks', String(s.blocked)],
            ['Extra days (weekend / holiday)', String(s.extra_days)],
            ['People', String(s.members)],
          ],
          list: s.not_logged?.length ? [`No logs last week: ${s.not_logged.join(', ')}`] : undefined,
          cta: { label: 'Open analytics', path: n.link ?? '/analytics?preset=last_week' },
        }),
      }
    }
    default:
      return {
        subject: n.title,
        ...renderEmail({ org, preheader: n.title, heading: n.title, paragraphs: [n.body ?? ''], cta: n.link ? { label: 'Open StrideLog', path: n.link } : undefined }),
      }
  }
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const secret = Deno.env.get('EMAIL_WEBHOOK_SECRET')
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { notification_id } = await req.json().catch(() => ({}))
  if (!notification_id) return new Response('notification_id required', { status: 400 })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: n, error } = await db.from('notifications').select('*').eq('id', notification_id).single()
  if (error || !n) return new Response('Not found', { status: 404 })
  if (n.emailed_at) return Response.json({ skipped: 'already sent' })

  const [{ data: person }, { data: org }] = await Promise.all([
    db.from('profiles').select('name, email, is_active').eq('id', n.user_id).single(),
    db.from('org_settings').select('company_name, logo_url, app_url').eq('id', 1).single(),
  ])
  if (!person?.email || person.is_active === false) return Response.json({ skipped: 'no recipient' })

  const email = build(n as Notification, person.name, org as Org)
  try {
    const { inlineLogo: needsLogo, ...content } = email
    const logo = needsLogo ? await inlineLogo(org as Org) : null
    const via = await sendEmail({ to: person.email, toName: person.name, fromName: org!.company_name, ...content, logo })
    await db.from('notifications').update({ emailed_at: new Date().toISOString() }).eq('id', n.id)
    return Response.json({ sent: true, via })
  } catch (err) {
    console.error('send failed', err)
    return Response.json({ sent: false, error: String(err) }, { status: 502 })
  }
})
