// Shared email layout + delivery for StrideLog notification emails.
//
// Delivery order:
//   1. RESEND_API_KEY set   → Resend (production)
//   2. MAILPIT_URL set      → local Mailpit (view at http://127.0.0.1:54324)
//   3. otherwise            → logged only

export type Org = { company_name: string; logo_url: string | null; app_url: string }

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export function renderEmail(opts: {
  org: Org
  preheader: string
  heading: string
  paragraphs: string[]          // plain text, escaped here
  rows?: [string, string][]     // optional key/value summary table
  list?: string[]               // optional bullet list
  cta?: { label: string; path: string }
  footer?: string
}) {
  const { org } = opts
  const appUrl = org.app_url.replace(/\/$/, '')
  const logo = org.logo_url && !/\.svg($|\?)/i.test(org.logo_url) ? org.logo_url : `${appUrl}/pwa-192x192.png`
  const ctaUrl = opts.cta ? `${appUrl}${opts.cta.path}` : ''

  const rows = opts.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;">
        ${opts.rows.map(([k, v], i) => `<tr><td style="padding:10px 14px;font-size:13px;color:#6b7280;${i ? 'border-top:1px solid #eef1f5;' : ''}">${esc(k)}</td>
        <td align="right" style="padding:10px 14px;font-size:14px;font-weight:600;color:#111827;${i ? 'border-top:1px solid #eef1f5;' : ''}">${esc(v)}</td></tr>`).join('')}
      </table>`
    : ''
  const list = opts.list?.length
    ? `<ul style="margin:8px 0 12px;padding-left:20px;color:#374151;font-size:14px;line-height:1.6;">${opts.list.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`
    : ''
  const button = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;"><tr><td style="border-radius:8px;background:#24416f;">
        <a href="${esc(ctaUrl)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:8px;">${esc(opts.cta.label)}</a>
      </td></tr></table>`
    : ''

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding:0 4px 20px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
  <td><img src="${esc(logo)}" width="36" height="36" alt="" style="display:block;border-radius:9px;"></td>
  <td style="padding-left:10px;font-size:18px;font-weight:700;color:#1d3254;">${esc(org.company_name)}</td>
</tr></table></td></tr>
<tr><td style="background:#fff;border-radius:10px;padding:30px 26px;border:1px solid #e2e8f0;">
  <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">${esc(opts.heading)}</h1>
  ${opts.paragraphs.map(p => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#374151;">${esc(p)}</p>`).join('')}
  ${rows}${list}${button}
</td></tr>
<tr><td style="padding:20px 8px;font-size:12px;line-height:1.5;color:#9ca3af;text-align:center;">
  ${esc(opts.footer ?? 'You can choose which emails you get in StrideLog, under Account.')}<br>${esc(org.company_name)} · StrideLog
</td></tr></table></td></tr></table></body></html>`

  const text = [
    opts.heading, '',
    ...opts.paragraphs,
    ...(opts.rows ?? []).map(([k, v]) => `${k}: ${v}`),
    ...(opts.list ?? []).map(l => `- ${l}`),
    ...(opts.cta ? ['', `${opts.cta.label}: ${ctaUrl}`] : []),
  ].join('\n')

  return { html, text }
}

export async function sendEmail(msg: { to: string; toName?: string; subject: string; html: string; text: string; fromName: string }) {
  const from = Deno.env.get('EMAIL_FROM') ?? 'notifications@example.com'
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const mailpit = Deno.env.get('MAILPIT_URL')

  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${msg.fromName} <${from}>`, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    })
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
    return 'resend'
  }

  if (mailpit) {
    const res = await fetch(`${mailpit.replace(/\/$/, '')}/api/v1/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        From: { Email: from, Name: msg.fromName },
        To: [{ Email: msg.to, Name: msg.toName ?? '' }],
        Subject: msg.subject, HTML: msg.html, Text: msg.text,
      }),
    })
    if (!res.ok) throw new Error(`Mailpit ${res.status}: ${await res.text()}`)
    return 'mailpit'
  }

  console.log(`[email not sent: no provider configured] to=${msg.to} subject=${msg.subject}`)
  return 'logged'
}
