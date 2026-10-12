# StrideLog v4: Manager focus, projects, dark mode

Branch: `feat/v4` (from `feat/v3-ui`).

**Status (9 Oct 2026): implemented.** Lint, 50 unit tests, 36 database permission
tests and the build pass. Checked in the browser: manager lands on Team, week grid
opens the side panel, Reports with 3 and 6 month periods for all and one employee,
project cards, creating a project, dark mode, collapsed sidebar, logo upload and a
project PDF with the logo on the cover.

## Requests and how they are met

| Request | Change |
|---|---|
| Manager lands on Team | Managers, HR and admins open on **Team**. **Today** leaves their main menu (still under Account). |
| Click a day in the week grid to see that employee's tasks on the right | A right side **drawer** (like Jira) opens with that day's tasks, notes and status. Works from the Day view too. Same for HR. |
| Today optional for managers and HR | Managers, HR and admins are no longer expected to log daily: no reminders, not counted in team numbers. |
| Employee filter and long periods | Reports gets three simple dropdowns: **Period** (this week, last week, this month, last month, last 3 months, last 6 months, this year, last year, custom), **Employee** (all or one), **Project** (all or one). Trends switch from weekly to monthly for long periods. |
| Managers create projects | New **Projects** page: create a project, add employees as members and managers as project managers. One employee can be in many projects; one manager can run many. Projects replace the old single "team" field. |
| Project chart | Reports shows a **Projects** section: tasks done, completion, people working on it, and a trend per project. Selecting a project scopes the whole report to it. |
| Company logo on report | Admin uploads the logo under Admin, Company. It appears in the app, PDF cover and emails. |
| Better splash, faster loading | Animated logo splash. Profile cached for instant start, self hosted font, heavy pages loaded on demand. |
| Clean code | Unused files and exports removed (teams, CSV, unused charts and metrics). |
| Collapsible sidebar, dark and light mode | Sidebar collapses to icons (remembered). Theme switch: Light, Dark or System. |

## Order of work

1. Database: projects, project members, project on tasks, analytics views, tracked roles for reminders.
2. Permissions, navigation, landing page, Projects page.
3. Team drawer; Reports filters, long periods, projects section.
4. Task form project field; reports and PDF use projects.
5. Splash, performance, cleanup.
6. Collapsible sidebar, dark mode.
7. Tests, visual check, commit.
