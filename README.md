# StrideLog

A simple daily work tracker for teams. Employees plan and tick off their day on
phone or desktop; managers and BAs assign work that lands straight in people's
daily lists; HR and managers see weekly/monthly productivity on dashboards and
download branded PDF reports.

No time tracking: productivity is measured by outcomes (tasks completed,
consistency of daily logs, assigned work done on time), not hours.

## Features

- **Team** (managers, HR, admins land here): pick a date to see what every
  employee is working on, or switch to **Week** for an employees by day grid.
  Click any day to open that person's tasks in a side panel (like Jira).
- **Reports**: three simple filters, **Period** (this week up to last year),
  **Employee** (all or one) and **Project** (all or one). Four headline numbers
  with tooltips, plain observations, a weekly or monthly trend, where the work
  went, project cards and an employee table.
- **Projects**: managers, HR and admins create projects, add employees and
  project managers. People can be in several projects; tasks carry a project so
  each project's progress can be analysed.
- **PDF reports**: weekly or monthly, for one employee, one project or all
  employees, with the company logo (Admin, Company tab) on the cover.
- **Today / My Progress** for employees: plan the day, tick tasks off, submit,
  and see their own week and month. Logging is optional for managers, HR and
  admins (it sits under Account) and they are left out of team numbers.
- **Email**: branded sign up, password reset and invite emails, plus
  notifications for assignments, approvals, a 6 pm reminder and a Monday summary.
- **Microsoft Teams sync**: meetings from Outlook calendars become tasks
  automatically (finished ones Done, upcoming ones To do, category picked from
  the title). Runs every 30 minutes on working days and when someone opens their
  day; anyone can opt out under Account.
- **Jira sync**: issues assigned to a person become tasks in their day and follow
  the Jira status (To do, In progress, In review, Done), instantly through a
  webhook and every 15 minutes. Each task links back to the issue.
- **Company sign in**: Continue with Microsoft, and sign ups on the company
  email domain are approved automatically (Admin, Company). The same email
  links each person's Teams calendar and Jira issues.
- **Connected apps** (Account): each person turns Teams and Jira on or off for
  themselves, syncs on demand, and can remove unfinished synced tasks when
  disconnecting.
- **Admin**: approve and invite people, set roles, grant "can assign tasks",
  manage categories, holidays and company branding.
- **Look and feel**: calm navy theme, **dark mode** (Light, Dark or System),
  collapsible sidebar, animated splash, installable app (PWA) with a phone tab bar.

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

Accounts: `admin@`, `manager@`, `hr@`, `ba@` (can assign), `arjun@`, `sara@`, `liam@`, all `@speedit.test`. The demo has three projects: Mobile App, Web Platform and Client Portal.

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

## Teams sync (one time setup, free)

Needs a Microsoft 365 admin, about 10 minutes. Microsoft Graph and the app
registration cost nothing; your existing Microsoft 365 licences are enough.

1. Microsoft Entra admin center, App registrations, New registration
   (name StrideLog, single tenant).
2. API permissions, Add, Microsoft Graph, **Application** permissions,
   `Calendars.Read`, then **Grant admin consent**.
3. Certificates and secrets, New client secret; copy the value.
4. Run once (Tenant ID and Client ID are on the app's Overview page):
   ```bash
   npx supabase secrets set MS_TENANT_ID=<tenant id> MS_CLIENT_ID=<client id> MS_CLIENT_SECRET=<secret value>
   npx supabase functions deploy teams-sync --no-verify-jwt
   ```
5. In StrideLog: Admin, Integrations, turn on **Turn on for the company**.

Locally, `TEAMS_SYNC_MOCK=true` in `supabase/functions/.env` creates sample
meetings so the whole flow can be tried without Microsoft 365.

## Jira sync (one time setup, free)

Uses your existing Jira Cloud plan; the REST API and webhooks cost nothing.

1. Signed in as a Jira admin, create an API token at
   https://id.atlassian.com/manage-profile/security/api-tokens.
2. Run once:
   ```bash
   npx supabase secrets set JIRA_SITE=https://<company>.atlassian.net JIRA_EMAIL=<admin email> JIRA_API_TOKEN=<token>
   npx supabase functions deploy jira-sync --no-verify-jwt
   ```
3. For instant updates, in Jira open Settings, System, WebHooks and add
   `https://<ref>.supabase.co/functions/v1/jira-sync?secret=<EMAIL_WEBHOOK_SECRET>`
   for Issue created, updated and deleted.
4. In StrideLog: Admin, Integrations, Jira, turn on **Turn on for the company**.

People are matched by email, so their StrideLog email must be the one they use
in Jira. Locally, `JIRA_SYNC_MOCK=true` creates sample issues.

## Sign in with Microsoft (optional)

In the Entra app registration used for Teams, add the redirect URI
`https://<ref>.supabase.co/auth/v1/callback`. In Supabase, Authentication,
Providers, Azure, paste the Client ID, secret and
`https://login.microsoftonline.com/<tenant id>/v2.0` as the URL. Set
`VITE_MICROSOFT_AUTH=true` for the frontend. Then set the company email domain
in Admin, Company so new people are approved automatically.

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
  functions/        send-email, invite-user, teams-sync, jira-sync (Edge Functions)
  templates/        Branded auth email templates
```

## License

Private project. All rights reserved.
