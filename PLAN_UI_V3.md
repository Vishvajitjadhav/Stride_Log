# StrideLog v3, Professional UI Upgrade Plan

Goal: make StrideLog look and feel like a mature corporate tool for reviewing
employee productivity. Simpler screens, fewer fields and tabs, a calm colour
scheme, metrics that explain themselves, and detailed, print‑quality reports.

Branch: `feat/v3-ui` (from `feat/v2`).

**Status (9 Oct 2026): implemented.** All sections below are built. Lint, 64
unit tests, 32 database permission tests and the production build pass. Team,
Reports and Today were checked in the browser at phone and desktop sizes, and
weekly and monthly PDFs for all employees were rendered and reviewed page by page.

---

## 1. Design rules (apply to every screen)

| Rule | Detail |
|---|---|
| Colour | Navy primary, neutral slate greys, one muted gold accent used sparingly. Status colours are muted (green, amber, red) and always paired with a text label. |
| Typography | Inter. Page title 20px semibold. Section title 15px semibold. Body 14px regular. Labels 12px medium grey. Numbers use tabular figures. No all‑caps purple headings. |
| Spacing | 4/8px grid. Cards 20px padding on desktop, 16px on phones. 24px between sections. |
| Shape | 8px corners, 1px light borders, almost no shadow. |
| Words | Plain English. Every metric says what it means. Tooltips (ⓘ) explain terms such as "Completion rate" or "Carried over". |
| No dashes | No "-", "–" or "—" in UI text. Empty values show "0" or "No data". Date ranges read "5 Oct to 11 Oct 2026". |
| Fewer fields | Only ask for what is needed; optional extras sit behind "Add details". |

## 2. Logo & brand

- New mark: a navy rounded square with three ascending "log lines" that rise
  like a stride, finished by a gold checkpoint. Reads as "progress, logged".
- Wordmark: **Stride** (semibold) + Log (regular), navy.
- Used in the app header, login, PWA icons, favicon, emails and PDF reports
  (company logo still replaces it when uploaded).

## 3. Navigation (fewer tabs)

| Role | Tabs |
|---|---|
| Employee | Today · My Progress |
| Manager | Team · Reports · Today · Settings (categories) |
| BA with assign permission | Team · Reports · Today |
| HR / Admin | Team · Reports · Today · Admin |

- Managers, HR and admins land on **Team**; everyone else lands on **Today**.
- Calendar and History are merged into **My Progress**.
- Analytics becomes **Reports**. Assigned tasks are reachable from Team.
- People + Settings merge into one **Admin** page with tabs.
- Import and password live under Profile (avatar menu).

## 4. Team page (manager's main screen)

- Date bar: ‹ date › with **Today**, and a **Day / Week** switch.
- **Day view**: one line summary ("5 of 7 submitted · 22 of 30 tasks done ·
  1 blocked"), then every employee with their tasks for that day (task,
  category, status) and blocker note. Not submitted people are shown first.
- **Week view**: a grid of employees × Mon to Sun. Each cell shows tasks done
  out of planned and whether the day was submitted. Tap a cell to see that day.
- Search and team filter only. Buttons: **Assign task**, **Download report**.

## 5. Reports page (fewer, meaningful metrics)

- Period: This week · Last week · This month · Last month · Custom.
- Four headline numbers, each with a one line meaning and tooltip:
  1. **Tasks completed**: tasks marked done in the period.
  2. **Completion rate**: share of planned tasks that were finished.
  3. **Daily logs submitted**: working days with a submitted log, out of
     expected days (weekends and holidays never count against anyone).
  4. **Blocked tasks**: tasks waiting on someone or something.
- **Key observations**: three or four plain sentences generated from the data
  (who completed the most, who has not logged, where most work went, trend vs
  last period).
- One chart: tasks completed each week (last 8 weeks).
- Employee table: Done / Planned, Completion, Logs submitted, Blocked, with
  header tooltips; tap a row to open that employee.
- **Download report**: weekly or monthly, for one employee, a team, or **all
  employees** in a single PDF.

## 6. Employee page (drill down)

- Header with name, role, team. Week / Month switch.
- Week: day by day table (Date, Task, Category, Status) plus that day's notes.
- Month: calendar. Download PDF for this employee.

## 7. Employee screens

- **Today**: task list + quick add. Task form fields: Task, Category, Status,
  Due date; "Add details" reveals notes. Daily notes reduced to **Summary** and
  **Blockers**.
- **My Progress**: this week's numbers with tooltips, this week day by day,
  month calendar with day detail, weekly trend.

## 8. PDF report (professional, detailed)

- Navy header band with logo, company name, report title, period, "Prepared
  for / by", date generated. Page numbers and confidentiality footer.
- **Summary page**: headline numbers vs previous period, key observations, and
  an employee summary table.
- **Weekly report, per employee section** (new page each): their numbers, then
  a **day by day table**: Day · Date · Task · Category · Status, with the day's
  submission state and blocker note. Weekend/holiday work marked as extra day.
- **Monthly report**: summary, employee table, week by week table per employee.
- "All employees" scope for managers, HR and admins.

## 9. Emails

- Same navy theme and new logo in auth and notification email templates.

## 10. Quality checks

- Grep UI strings for dash characters; none allowed.
- Unit tests for report grouping and observations; existing tests stay green.
- Visual check at phone (375px) and desktop (1280px) sizes, PDF rendered and
  reviewed page by page.

---

## Order of work

1. Theme tokens, typography, logo, icons. 
2. Tooltip, Card, Badge, Button, layout and navigation.
3. Team page (day / week).
4. Reports page + observations + employee table.
5. Employee page, My Progress, Today, task form.
6. PDF report redesign with all employees option.
7. Emails, dash sweep, tests, visual review, commit.
