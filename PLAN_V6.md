# StrideLog v6: One clear view of work (Board, Reports, auto day status)

**Status (28 Oct 2026): plan approved with the default decisions. Batch 1 built, in review.**

Main purpose: anyone from a team lead to the CEO can open StrideLog and understand, in under a
minute, what work got done this week or month, on which project, by whom, and whether people
and projects are improving. Simple first, detail on click.

## Batches

Tick a batch (`[x]`) and strike it through when it is merged.

- [ ] **Batch 1. Foundations: status colours, filters, project picker** (in review: branch `feat/v6-foundations`)
- [ ] **Batch 2. Day status without a Submit button**
- [ ] **Batch 3. Jira for the whole company**
- [ ] **Batch 4. Team board and team calendar**
- [ ] **Batch 5. Reports page like the sample**
- [ ] **Batch 6. Insights: is it improving?**
- [ ] **Batch 7. Final pass: every screen size, dark mode, tests**

One branch and one PR per batch, so each can be checked on its own.

---

## Batch 1. Foundations

Everything later reuses these, so the whole app stays consistent.

1. **Status model.** Add `in_review` to task statuses (today Jira "In Review" and "Ready for QA"
   are squeezed into "In progress"). Final set: To do, In progress, In review, Done, Blocked.
2. **Status colours, one place** (`StatusBadge` and card tint, used everywhere):

   | Status | Colour | Why |
   |---|---|---|
   | To do | White card, grey badge | Not started is normal, not a problem |
   | In progress | Soft amber tint | Work is moving |
   | In review | Soft blue tint | Waiting on someone else |
   | Done | Soft mint (green) tint, check icon | Finished |
   | Blocked | Soft red tint | Needs help |
   | Stuck (no change for 5 working days) or overdue | Red outline on the card | Needs attention |

   Change from your idea: To do stays white, not red. Red should only mean "something is wrong",
   otherwise managers learn to ignore red. Every badge also has a text label, so it works for
   colour blind people and in the black and white PDF.
3. **One filter bar** used on Board, Calendar and Reports:
   * When: Today, This week, This month (plus pick a week or month)
   * Source: StrideLog, Jira, Teams (on and off chips; all on by default)
   * Project and Person (BA and managers)
   The choice is kept in the URL, so a filtered view can be shared as a link.
4. **One project picker** (`ProjectPicker`) used in My Day quick add, the task editor, and when a
   BA assigns a task. When assigning, the BA picks the project first and the person list narrows
   to people in that project (today the project field only appears after picking a person).

## Batch 2. Day status without a Submit button

You are right that Submit day is extra work. Proposal:

* Remove the Submit day button. The day status is worked out from activity:
  * **Active**: at least one task added, updated or finished that day (from StrideLog, Jira or Teams)
  * **No activity**: a working day with nothing logged (shown after the day ends)
  * **Leave, Holiday, Weekend**: as today
* "What I did" notes stay, but optional, saved automatically as you type.
* Team page, day drawer, metrics ("Daily logs" becomes "Active days"), weekly PDF and reminder
  emails switch to the new status. Old submitted days count as Active, so history is kept.
* Counter point: a person with only meetings would show Active. Meetings count as activity but
  are shown separately in reports so they do not look like finished tasks.

## Batch 3. Jira for the whole company

Today only people who connected their own Jira are synced, and unassigned issues are invisible.

* Admin connects one company Jira account (Admin, Integrations) and picks which Jira projects
  to read.
* Sync stores every issue of those projects: key, title, Jira status, assignee, project, sprint,
  updated and resolved dates. Assignee is matched to a StrideLog person by email.
* Issues stay in sync every 15 minutes plus a Jira webhook for instant updates.
* Personal connections keep working for people's own My Day.
* Jira project mapped to a StrideLog project once in settings (no more name matching).

## Batch 4. Team board and team calendar

Inside the existing Team page, as a switch at the top: **People** (today's view), **Board**,
**Calendar**. No new nav tab.

* **Board**: columns To do, In progress, In review, Done (Blocked shown as a red flag on the card).
  Cards show title, Jira key or source icon, person, project, and how long in this column.
  "Unassigned" and "Stuck" counters on top. Uses the Batch 1 filter bar, including the
  StrideLog, Jira, Teams switches.
* **Calendar**: week grid, people down the side, days across. Each cell shows that person's
  Teams meetings and tasks for the day with status colours. Today highlighted. On phones it
  becomes one day at a time with a swipe.
* Employees see their own board; BAs, managers and HR see everyone (same rules as today).

## Batch 5. Reports page like the sample

Rebuild Reports in the layout of `Weekly_Report_Dashboard 3.html`, with live data:

* Weekly or Monthly switch and a period picker; left side filters for People, Projects,
  Status, Source (moves above the content on phones).
* Clickable KPI tiles: Assigned, Done, In review, In progress, To do, Completion.
* Status split ring, By employee and By project stacked bars. Clicking a bar filters the page.
* Task table: sortable, click a row to see the details, Expand all.
* Save as Excel (summary sheet plus task sheet, like the sample), CSV, and the existing detailed
  PDF. Word export only if you need it, since PDF already covers printing.
* Search box for task, key or person.

## Batch 6. Insights: is it improving?

A short section at the top of Reports, written for the CEO:

* Three or four plain sentences: "This week the team finished 42 tasks, 8 more than last week.
  Billing is 70% done for October. 3 issues have been stuck for over a week."
* Each person: tasks done, completion, active days, and a small trend line for the last 6 weeks
  with an Improving, Steady or Dropping label.
* Each project: done this month, open work, trend.
* Needs attention list: stuck issues, overdue tasks, unassigned issues, people with no activity.

Counter point: counting tasks alone is unfair, because one task can be 1 hour or 3 days, and it
rewards splitting work into many small tasks. The trend compares each person with their own past,
not with each other, and if your Jira uses story points we can show points next to counts later.

## Batch 7. Final pass

Phone (375), tablet, laptop and 27 inch checks in light and dark, no dash characters in UI text,
unit tests for status mapping, day status and report maths, lint and build.

---

## Decisions to confirm (default in bold)

1. Company Jira connection by an admin account: **yes**
2. Stuck means no change for: **5 working days**
3. Day counts as Active from: **any task added, updated or finished, or a Teams meeting**
4. Board for employees: **their own work only**
5. Word export: **skip, Excel and PDF are enough**
