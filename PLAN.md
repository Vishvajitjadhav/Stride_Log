# StrideLog v2 — Implementation Plan

Goal: a simple, easy-to-maintain daily work tracker where employees log tasks, managers/BAs
assign and update tasks, and HR/managers analyse weekly & monthly productivity through
dashboards, calendar views and downloadable PDF reports — usable as an installable mobile app (PWA).

Stack stays the same (React 19 + Vite + Tailwind + TanStack Query + Supabase/Postgres).
Every phase is one or more small commits on a feature branch (`feat/v2-*`), merged into `main`.

## Status (2026-10-09)

Phases 0–7 are implemented on branch `feat/v2` and verified locally (32 pgTAP
permission tests, 58 unit tests, lint, production build, and the main flows in
the browser at phone and desktop sizes). Phase 8 needs your Supabase, Resend and
hosting accounts — the steps are in the README under **Deploying**.

Changes from the original plan:
- Analytics read two RLS-respecting views (`v_task_facts`, `v_log_facts`) and
  aggregate in `src/utils/metrics.js` (pure, unit-tested) rather than one RPC per chart.
- Managers and granted BAs work company-wide, as decided.
- Unfinished tasks carry over in My Day for 30 days; older ones stay in History and reports.
- Offline: the app shell and today's notes work offline; task edits sync when the connection returns.

---

## Guiding principles

- **No time tracking.** Tasks have no hours. Productivity = outcomes (tasks done, logs submitted,
  assigned work completed on time), never time spent. Avoids micromanagement.
- **Permissions live in the database (RLS)**, not just the UI. The UI only hides what RLS already blocks.
- **One task table.** Self-created and assigned tasks are the same rows, so an assignment
  shows up in the assignee's daily list automatically.
- **Mobile first.** Every screen is designed at 375px first, then widened.
- **Keep it boring.** No new backend server: Supabase (DB, Auth, Storage, Edge Functions, cron) does everything.

---

## Roles & permissions

Roles (one per user): `employee`, `ba`, `manager`, `hr`, `admin`.
Plus one grantable permission: **`can_assign_tasks`** — admin can switch it on for any user
(e.g. a BA or team lead) from the People page.

| Capability | Employee | BA | Manager | HR | Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Log own daily tasks, view own history/dashboard/calendar | ✅ | ✅ | ✅ | ✅ | ✅ |
| Download own weekly/monthly PDF | ✅ | ✅ | ✅ | ✅ | ✅ |
| Assign / edit tasks for others | — | if granted (everyone) | ✅ everyone | — | ✅ everyone |
| View team dashboards & reports | — | if granted | ✅ all | ✅ all | ✅ all |
| Company-wide analytics & PDF | — | — | ✅ | ✅ | ✅ |
| Approve sign-ups, edit profiles, set team/manager | — | — | — | ✅ | ✅ |
| Manage holidays (calendar) | — | — | — | ✅ | ✅ |
| Manage categories | — | — | ✅ | ✅ | ✅ |
| Grant `can_assign_tasks`, set roles incl. admin, company settings & logo | — | — | — | — | ✅ |

Managers and granted BAs work across the **whole company** (no team restriction).
Teams are still stored (`team_id`, `manager_id`) for grouping, filters and reports.

---

## Data model changes

```
teams            (id, name, lead_id → profiles)
profiles         + team_id, manager_id, can_assign_tasks bool, role adds 'ba','hr'
tasks            + date (the day it belongs to), assigned_by, description, priority, due_date,
                   updated_by, updated_at;  log_id becomes nullable;  DROP hours;
                   status adds 'blocked'
categories       reseeded (see below)
holidays         (date, name)                      -- excluded from "missed log" counts
org_settings     (single row: company_name, logo_url, week_start, timezone, report_footer)
notifications    (id, user_id, type, payload, read_at, created_at)  -- in-app bell
```

Storage bucket `branding` (public read, admin write) for the company logo.

Default categories: Development, Brainstorming, Team Meeting, Scrum Call, Interview,
Client Call, Design, Testing, Code Review, Documentation, Research, Training, Support.
(Managers/HR/Admin can add, rename, recolour, deactivate.)

SQL helper functions (all `SECURITY DEFINER SET search_path = public`):
`my_role()`, `is_admin()`, `is_hr_or_admin()`, `can_manage_user(target uuid)`,
`can_view_user(target uuid)`. All RLS policies are rewritten around these so the rules
read like the table above.

---

## Phase 0 — Security fix & housekeeping  *(do first, small)*

- [x] Branch off `main`; set local default branch to match.
- [x] **Fix privilege escalation:** `"own profile update"` lets a user change their own
      `role` / `is_approved`. Replace with a trigger that blocks changes to `role`,
      `is_approved`, `is_active`, `team_id`, `manager_id`, `can_assign_tasks` unless the caller is HR/admin.
- [x] Add `SET search_path = public` to all `SECURITY DEFINER` functions.
- [x] Fix UTC date bug in dashboard 30-day window (use `date-fns` local dates everywhere).
- [x] Page title / favicon → "StrideLog".

## Phase 1 — Roles, teams, permissions (DB)

- [x] Migration: roles `ba`, `hr`; `teams`; `team_id`, `manager_id`, `can_assign_tasks` on profiles.
- [x] Migration: helper functions + rewritten RLS for profiles / work_logs / tasks / categories.
- [x] **pgTAP tests** (`supabase test db`) that sign in as each role and assert allowed/denied
      reads & writes — this is the safety net that keeps permissions maintainable.
- [x] `AuthContext` exposes `role`, `can(action, targetUser?)` helper; replace scattered
      `isStaff/isAdmin` checks with it.

## Phase 2 — Connected tasks & assignment

- [x] Migration: `tasks.date`, `assigned_by`, `description`, `priority`, `due_date`,
      `updated_by/updated_at`, `blocked` status, nullable `log_id`; **drop `hours`**
      (also remove from Excel import mapping & CSV export).
- [x] Reseed categories.
- [x] **My Day** (replaces "Log Today"): today's tasks = my tasks for today + unfinished
      tasks carried over from earlier days + tasks assigned to me. Badge "Assigned by Priya".
      Quick add, swipe/tap to change status, notes (what I did / blockers / tomorrow), Submit.
- [x] **Assign Task** sheet (for users with permission): pick person (only those I may
      manage), title, category, priority, due date, description. Appears instantly in the
      assignee's My Day (Supabase Realtime subscription).
- [x] Managers/BAs can edit status/title/due date of their team's tasks; every change records
      `updated_by` and shows "edited by X" to the employee.
- [x] In-app notification bell (new assignment, task edited, account approved).

## Phase 3 — Calendar

- [x] Month calendar (own; manager/HR can switch person/team).
      Each day coloured: submitted ✓ / missed ✗ / partial / weekend / holiday / future;
      weekend or holiday days with logged work get a distinct "extra day" ★ marker.
      Dots for tasks due. Tap a day → that day's log & tasks (editable if allowed).
- [x] Week strip version on mobile dashboard.
- [x] HR/Admin: Holidays manager.

## Phase 4 — Dashboards & analytics

Metrics (no hours):
- **Tasks completed** and **completion rate** (done ÷ planned)
- **Log consistency** = days submitted ÷ working days (Mon–Fri, excluding holidays)
- **Extra days** = weekend/holiday days with logged work — shown as a bonus, never penalised when missing
- **Assigned-on-time rate** = assigned tasks done by due date
- **Carry-over** = tasks rolled from a previous day (signals overload, not laziness)
- **Blockers raised** and open blockers list
- **Category mix** (where effort goes: dev vs meetings vs interviews…)
- **Growth** = every metric vs previous period (▲/▼ %), and 8-12 week trend lines

Dashboards:
- [x] **My Dashboard** (everyone): this week KPIs, trend vs last week, streak, category donut, upcoming due tasks.
- [x] **Team Dashboard** (manager / granted BA): KPI row, per-person table (sortable),
      who hasn't logged today, open blockers feed, category mix, weekly trend.
- [x] **Company Dashboard** (HR/Admin): same, grouped by team; team comparison chart;
      compliance heatmap (people × days).
- [x] **Person drill-down**: any row → that person's trends, calendar, tasks.

Filters (one shared `FilterBar`, stored in URL so views are shareable/bookmarkable):
- Date: This week · Last week · This month · Last month · This quarter · Custom range
- Compare to: previous period / same period last month / none
- Team · Person · Role · Category · Task status · Assigned vs self-created

Performance: aggregation moves into SQL views/RPCs (`rpc('team_metrics', {from,to,team})`)
instead of downloading every row to the browser.

## Phase 5 — PDF reports

- [x] Library: `@react-pdf/renderer` (lazy-loaded, real selectable text, crisp vector charts).
- [x] Report types: **Weekly** and **Monthly** × scope **Me / Person / Team / Company**
      (scope options limited by role).
- [x] Layout: header with **company logo + name**, report title, **date range**,
      generated on/by; KPI summary with growth arrows; trend bar chart; category breakdown;
      per-person table (team/company); highlights (top completed tasks) & blockers;
      footer with page numbers and confidentiality note.
- [x] "Download PDF" button on every dashboard uses the current filters.
- [x] Admin Settings: company name, logo upload (Supabase Storage), week start day, timezone.

## Phase 6 — Email (auth + notifications)

Auth emails (Supabase Auth):
- [x] Branded HTML templates in `supabase/templates/`: confirm sign-up, **reset password**,
      invite user, magic link, email change. Logo, button, plain-text fallback.
- [x] Wire templates in `config.toml` (local). Hosted: paste into the dashboard at deploy time.
- [ ] Production SMTP via **Resend** (`smtp.resend.com`) — Supabase's built-in mailer
      is rate-limited to a few emails/hour and not for production.
- [x] **Forgot password end-to-end test**: request → email → `/reset-password` →
      `PASSWORD_RECOVERY` event → new password → signed in. Add production URL to redirect allow-list.
- [x] Admin/HR "Invite user" (sends invite email, pre-sets role/team, auto-approved).

App emails (Supabase Edge Function `send-email` + Resend API, templates in
`supabase/functions/_shared/templates/`):
- [x] Task assigned to you / task edited
- [x] Your account was approved
- [x] Daily reminder at 6 pm if today's log not submitted (pg_cron, Mon–Fri only, skips holidays)
- [x] Monday weekly summary to managers/HR (with link to dashboard & PDF)
- [x] Per-user email preference toggles (so it doesn't become spam).

## Phase 7 — Mobile UX & PWA

- [x] Responsive layout: sidebar on ≥1024px; **bottom tab bar** on mobile
      (My Day · Calendar · Dashboard · Team · More); FAB "+ Task".
- [x] Tables become cards on small screens; 44px tap targets; bottom-sheet modals;
      safe-area insets (iPhone notch); skeleton loaders; data refreshes when the app regains focus (instead of pull-to-refresh).
- [x] `vite-plugin-pwa`: manifest (name, theme colour, icons 192/512/maskable from logo),
      service worker with app-shell caching, "Install app" prompt, "New version available — reload" toast.
- [x] Offline: My Day draft saved locally and synced when back online.
- [ ] Lighthouse PWA + accessibility score ≥ 90 (run against the deployed HTTPS build).

## Phase 8 — Deploy

- [ ] Create hosted Supabase project; `supabase db push`; set Auth URLs, SMTP, Google OAuth
      redirect URIs, email templates, pg_cron, Edge Function secrets.
- [ ] Deploy frontend to Vercel/Netlify (HTTPS is required for PWA install).
- [ ] Create first admin; import existing data; smoke-test each role on phone + desktop.
- [x] README: setup, roles table, how to add a user, how to run tests.

---

## Suggested order & rough size

| Phase | What | Size |
|---|---|---|
| 0 | Security fix & housekeeping | S |
| 1 | Roles, teams, RLS + tests | M |
| 2 | Connected tasks & assignment | L |
| 7 | Mobile layout & PWA *(early, so every later screen is built mobile-first)* | M |
| 3 | Calendar | M |
| 4 | Dashboards & filters | L |
| 5 | PDF reports | M |
| 6 | Email | M |
| 8 | Deploy | S |

## Open decisions (confirm before Phase 1)

Decided: BA (when granted) and Managers can assign to / view **everyone**; email via **Resend**;
working days **Mon–Fri**, weekend work allowed and counted as "extra days".

1. **Existing `hours` data** — OK to drop permanently? (Export a backup first.)
2. **Resend sending domain** (e.g. `notify.yourcompany.com`) — needs DNS records added.
3. **Company logo & name** for reports/PWA icon.
