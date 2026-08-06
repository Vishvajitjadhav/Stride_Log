# StrideLog

A work-tracking web app for teams. Employees log their daily work, and managers get approvals, people management, and team analytics — all backed by Supabase with row-level security and role-based access.

## Features

**For employees**
- Dashboard with an at-a-glance view of logged work
- Log daily work entries against categories/tasks
- Browse and filter personal work history

**For managers / admins**
- People view and per-member detail pages
- Approve pending work entries
- Team analytics and charts (powered by Recharts)
- Import data in bulk from Excel spreadsheets
- Team settings and category management

**Platform**
- Authentication via Supabase (email/password, Google sign-in, password reset)
- Role-based access (employee / manager) with a user-approval flow
- Postgres schema with Row-Level Security policies

## Tech stack

- **Frontend:** React 19, React Router 7, Vite 8
- **Styling:** Tailwind CSS 4
- **State/data:** TanStack Query, Zustand
- **Backend:** Supabase (Postgres, Auth, RLS)
- **Charts:** Recharts
- **Excel import:** SheetJS (`xlsx`)
- **Dates:** date-fns
- **Testing:** Vitest, Testing Library

## Getting started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project

### Installation

```bash
git clone https://github.com/Vishvajitjadhav/Stride_Log.git
cd Stride_Log
npm install
```

### Environment variables

Create a `.env.local` file in the project root:

```bash
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

> `.env.local` is gitignored — never commit your keys.

### Database setup

Apply the migrations in `supabase/migrations/` to your Supabase project (via the [Supabase CLI](https://supabase.com/docs/guides/cli) or the SQL editor). Optionally seed sample data with `supabase/seed_data.sql` or `supabase/seed_demo_team.sql`.

### Run

```bash
npm run dev
```

The app runs at `http://localhost:5173` by default.

## Scripts

| Command           | Description                       |
| ----------------- | --------------------------------- |
| `npm run dev`     | Start the Vite dev server         |
| `npm run build`   | Build for production              |
| `npm run preview` | Preview the production build      |
| `npm run lint`    | Run ESLint                        |

## Project structure

```
src/
  pages/          Employee pages (Dashboard, Log, History) + admin/ pages
  pages/admin/    PeopleView, MemberDetail, TeamAnalytics, Approvals, Settings
  components/     Layout, UI primitives, SplashScreen, PendingApproval
  hooks/          Data hooks (useWorkLog, useTeam, useTasks, useImport, ...)
  contexts/       Auth context
  lib/            Supabase client
  utils/          Helpers
supabase/
  migrations/     Schema, RLS policies, role & approval migrations
  seed_data.sql   Sample data
```

## License

Private project. All rights reserved.
