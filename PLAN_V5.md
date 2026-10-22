# StrideLog v5: Bulk import, fresh UI, every screen, PWA

Branch: `feat/v5-fresh-ui` (from `feat/connect-own-accounts`).

**Status (22 Oct 2026): implemented, not yet committed.** Lint, 73 unit tests (11 new for
bulk import) and the build pass. Checked in the browser at 375, 768, 1440 and 2560 wide
(no page scrolls sideways), light and dark: reports, leaderboard, team, admin, projects,
profile. Holiday import tested end to end. People import tested up to the account
creation call: the local `invite-user` edge function returned 503 because it is not
being served locally (`supabase functions serve`), so that last step still needs a check.

## Requests and how they are met

| Request | Change |
|---|---|
| Bulk add people | Admin, People: **Import** button next to Add person. Download an Excel or CSV template (Full name, Work email, Role, Project), fill it, upload. Every row is checked before anything is created (missing name, bad email, duplicate in file, email already in StrideLog, unknown role or project). Valid rows are created one by one with a progress bar using the existing `invite-user` function (temporary password or email invite). At the end, download a sign in sheet with every temporary password. |
| Bulk add holidays | Admin, Holidays: **Import** button. Template with Date and Holiday name. Dates in any common format (22/10/2026, 22 Oct 2026, Excel dates). Existing dates are updated, not duplicated. Saved in one request. |
| Fresh, energetic, light, premium, easy on the eyes | New design tokens: bright indigo primary with a mint accent for success and warm amber for awards, on a soft off white canvas with a faint colour wash. Light sidebar (was dark navy) with a pill highlight. Glassy sticky top bar. Cards with larger radius, hairline border and soft layered shadow. Gradient primary button. Calmer greys for text so long reading is easy. Dark mode follows the same tokens. Login and landing get the same fresh look. |
| Every screen size (27 inch to iPhone) | Content width scales up on large monitors (wider max width on 2xl). Sidebar on desktop, collapsible; tablet gets the bottom bar with larger touch targets. Wide tables get a phone friendly card list (leaderboard ranking). Sheets are full width bottom sheets on phones. Safe area padding for notched phones. Checked at 1920, 1440, 1024, 768, 390 and 375 wide. |
| Installable app on mobile (PWA) | Already a PWA; improved: manifest colours match the new brand, `orientation: any` so tablets can rotate, `id` and `display_override`, app icons regenerated in the new colour, theme colour follows light and dark. New dismissible **Install StrideLog** banner on phones and tablets (Android shows the install prompt, iPhone shows the Share then Add to Home Screen steps). Bottom bar floats with blur in the installed app. |
| Attractive reports and leaderboard with animation | Numbers count up on load. KPI cards get an icon chip and coloured trend pill. Charts animate in with gradient bars. Leaderboard: podium with gold, silver and bronze plinths that rise in, crown on first place, score rings that fill, highlight cards with colour, ranking rows that slide in one after another, phone card list. Reduced motion setting turns all animation off. |

## UI text rules kept

No dash characters in UI text, few fields, tooltips where a term needs explaining.

## Order of work

1. Plan (this file).
2. Bulk import: pure parsing and validation module with unit tests, shared import sheet (template download, upload, preview, progress, result), wired into People and Holidays.
3. Design tokens and primitives: palette, Card, Button, Badge, Sheet, inputs, tables.
4. Layout: light sidebar, glass top bar, floating bottom bar, responsive widths, login and landing.
5. PWA: manifest, icons, theme colour, install banner.
6. Reports and leaderboard: count up, animated charts, podium, rings, phone list.
7. Lint, tests, build, check in the browser at several sizes, commit.
