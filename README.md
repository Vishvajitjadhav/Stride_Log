# StrideLog

A simple daily work tracker for teams. Employees plan and tick off their day on
phone or desktop; managers and BAs assign work that lands straight in people's
daily lists; HR and managers see weekly/monthly productivity on dashboards and
download branded PDF reports.

No time tracking: productivity is measured by outcomes (tasks completed,
consistency of daily logs, assigned work done on time), not hours.

## Features

- **Today**: the employee's task list for the day, with unfinished work carried
  over and tasks assigned by a manager. Quick add, a two field daily note
  (summary and blockers) and one tap "Submit day". Works on phone and desktop.
- **Team** (managers, HR, admins): pick a date and see what every employee is
  working on that day, or switch to **Week** for an employees by day grid showing
  tasks done and whether each day was submitted. Assign tasks from here.
- **Reports**: four meaningful numbers (tasks completed, completion rate, daily
  logs submitted, blocked tasks), each explained with a tooltip. Also plain
  English key observations, an 8 week trend, where the work went, and an
  employee table.
- **PDF reports**: weekly or monthly, for one employee, a team or **all
  employees**. A professional summary page is followed by a page per employee.
  Weekly reports list every task day by day with its status and the day's notes.
- **My Progress**: the employee's own week (day by day), month calendar and trend.
- **Email**: branded sign up, password reset and invite emails, plus
  notifications for assignments, approvals, a 6 pm reminder and a Monday summary.
- **Admin**: approve and invite people, set roles and teams, grant "can assign
  tasks", and manage categories, holidays and company branding.
- **Installable app (PWA)** with a phone tab bar and an offline app shell.

The interface follows a calm corporate style: navy and slate colours, plain
language, tooltips for every metric and no dash characters in the text.

## Roles

| Capability | Employee | BA | Manager | HR | Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Own day, dashboard, calendar, history, own PDF | ✅ | ✅ | ✅ | ✅ | ✅ |
| Assign / edit tasks for anyone | — | if granted | ✅ | — | ✅ |
| Team dashboards & analytics (everyone) | — | if granted | ✅ | ✅ | ✅ |
| Company-wide PDF report | — | — | ✅ | ✅ | ✅ |
| Approve sign-ups, invite, edit people | — | — | — | ✅ | ✅ |
| Teams & holidays | — | — | — | ✅ | ✅ |
| Categories | — | — | ✅ | ✅ | ✅ |
| Grant "can assign tasks", make admins, company logo | — | — | — | — | ✅ |

The database enforces all of this with Row-Level Security and triggers
(`supabase/migrations`), and `supabase/tests` checks every role. The UI reads the
same rules from `src/lib/permissions.js`.

## Tech stack

React 19 · Vite 8 · Tailwind CSS 4 · TanStack Query · Recharts · @react-pdf/renderer ·
vite-plugin-pwa · Supabase (Postgres, Auth, RLS, Realtime, Storage, Edge Functions, pg_cron, pg_net) · Resend (email)

## Local development

Prerequisites: Node 18+, Docker Desktop.

```bash
npm install
npx supabase start                          # Postgres, Auth, Storage, Mailpit, Edge Functions
cp supabase/functions/.env.example supabase/functions/.env
```

Create `.env.local` with the values printed by `npx supabase status`:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<ANON_KEY>
```

Load the demo company (optional). The password for every demo account is `stridelog123`:

```bash
docker exec -i supabase_db_stridelog psql -U postgres < supabase/seed_demo_team.sql
```

Accounts: `admin@`, `manager@`, `hr@`, `ba@` (can assign), `arjun@`, `sara@`, `liam@` — all `@speedit.test`.

```bash
npm run dev          # http://localhost:5173
```

All emails sent locally (auth and notifications) appear in Mailpit at
http://127.0.0.1:54324.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` / `npm run preview` | Production build / preview (includes service worker) |
| `npm test` | Unit tests (metrics, permissions, dates, import) |
| `npm run test:db` | pgTAP permission tests against the local database |
| `npm run lint` | ESLint |
| `npm run icons` | Regenerate favicon/PWA icons from `public/logo.svg` |

## Deploying

1. **Supabase project**: create one at supabase.com, then:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   npx supabase functions deploy send-email --no-verify-jwt
   npx supabase functions deploy invite-user
   npx supabase secrets set EMAIL_WEBHOOK_SECRET=<random> EMAIL_FROM=notifications@<your-domain> RESEND_API_KEY=<key>
   ```
   In the SQL editor, point the database at your functions (same secret as above):
   ```sql
   UPDATE private.config SET value = 'https://<ref>.supabase.co/functions/v1' WHERE key = 'functions_url';
   UPDATE private.config SET value = '<random>' WHERE key = 'email_webhook_secret';
   UPDATE org_settings SET app_url = 'https://<your-app-domain>', company_name = '<Company>' WHERE id = 1;
   ```
2. **Resend**: verify your sending domain (add the DNS records Resend shows).
   Then, in Supabase → Authentication → Emails → SMTP, set host
   `smtp.resend.com`, port `465`, user `resend`, and your API key as the password.
   Without this, Supabase's built-in mailer sends only a few emails per hour.
3. **Auth settings** (Supabase dashboard → Authentication):
   - Site URL = your app URL.
   - Redirect URLs: add `https://<your-app-domain>/**`.
   - Turn on "Confirm email".
   - Paste each file from `supabase/templates/` into the matching email template.
4. **Frontend**: deploy to Vercel or Netlify with the two `VITE_` env vars.
   `vercel.json` / `public/_redirects` handle SPA routing. HTTPS is required for
   installing the PWA.
5. **Schedules**: the reminder (18:00 IST) and weekly summary (Mon 09:00 IST)
   run on pg_cron in UTC. Adjust them in `cron.job` if your company isn't on IST.
6. Sign up with your own email. Then, in the SQL editor, run:
   `UPDATE profiles SET role='admin', is_approved=true WHERE email='you@company.com';`
   From then on, invite everyone else from **Admin → People**.

## Project structure

```
src/
  pages/            MyDay, Dashboard, Calendar, History, Team, MemberDetail,
                    Analytics, Assigned, Profile, More, ImportData, auth pages
  pages/admin/      People (approvals, roles, invites), Settings
  components/       layout (sidebar, bottom tabs), tasks, charts, reports (PDF), ui
  hooks/            Data hooks (tasks, work logs, analytics, people, org, notifications)
  lib/              Supabase client, permissions, install prompt, labels
  utils/            metrics (pure KPI maths), dates, csv, import mapping
supabase/
  migrations/       Schema, RLS, triggers, notifications, cron
  tests/            pgTAP role/permission tests
  functions/        send-email, invite-user (Edge Functions)
  templates/        Branded auth email templates
```

## License

Private project. All rights reserved.
