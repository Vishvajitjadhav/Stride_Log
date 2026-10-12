-- Phase 1: roles (employee, ba, manager, hr, admin), teams, the grantable
-- can_assign_tasks permission, and RLS rewritten around a few helper functions.
--
-- Access summary (mirrors PLAN.md):
--   everyone (approved)  : own logs/tasks; read profiles, teams, categories, holidays
--   viewer  = manager | hr | admin | can_assign_tasks : read everyone's logs/tasks
--   assigner = manager | admin | can_assign_tasks     : create/edit tasks for anyone
--   hr_or_admin          : approve/edit people, teams, holidays
--   manager | hr | admin : manage categories
--   admin                : roles incl. admin, grant can_assign_tasks, company settings

-- ── Schema ────────────────────────────────────────────────────────────────────

CREATE TABLE teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  lead_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('employee', 'ba', 'manager', 'hr', 'admin'));

ALTER TABLE profiles
  ADD COLUMN team_id          uuid REFERENCES teams(id) ON DELETE SET NULL,
  ADD COLUMN manager_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN can_assign_tasks boolean NOT NULL DEFAULT false,
  ADD COLUMN email_prefs      jsonb NOT NULL
    DEFAULT '{"assigned": true, "updated": true, "reminder": true, "weekly": true}'::jsonb;

-- ── Helper functions ──────────────────────────────────────────────────────────
-- SECURITY DEFINER so they can read profiles without recursing through RLS.

CREATE OR REPLACE FUNCTION my_role()
RETURNS text AS $$
  SELECT role FROM profiles
  WHERE id = auth.uid() AND is_approved AND is_active;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_member()
RETURNS boolean AS $$
  SELECT my_role() IS NOT NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT coalesce(my_role() = 'admin', false);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_hr_or_admin()
RETURNS boolean AS $$
  SELECT coalesce(my_role() IN ('hr', 'admin'), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION can_assign()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_approved AND is_active
      AND (role IN ('manager', 'admin') OR can_assign_tasks)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION can_view_all()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_approved AND is_active
      AND (role IN ('manager', 'hr', 'admin') OR can_assign_tasks)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION can_manage_categories()
RETURNS boolean AS $$
  SELECT coalesce(my_role() IN ('manager', 'hr', 'admin'), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ── Profile guard (replaces the Phase 0 version) ──────────────────────────────

CREATE OR REPLACE FUNCTION guard_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NULL OR is_admin() THEN
    RETURN NEW;  -- service role, migrations, admins
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Not allowed to change id or email' USING ERRCODE = '42501';
  END IF;

  IF is_hr_or_admin() THEN
    -- HR manages people but cannot create/touch admins or grant task assignment.
    IF NEW.role = 'admin' OR OLD.role = 'admin' THEN
      RAISE EXCEPTION 'Only an admin can manage admin accounts' USING ERRCODE = '42501';
    END IF;
    IF NEW.can_assign_tasks IS DISTINCT FROM OLD.can_assign_tasks THEN
      RAISE EXCEPTION 'Only an admin can grant task assignment' USING ERRCODE = '42501';
    END IF;
    IF OLD.id = auth.uid() AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'You cannot change your own role' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Everyone else may only edit their own name / initials / email preferences.
  IF NEW.role             IS DISTINCT FROM OLD.role
  OR NEW.is_approved      IS DISTINCT FROM OLD.is_approved
  OR NEW.is_active        IS DISTINCT FROM OLD.is_active
  OR NEW.team_id          IS DISTINCT FROM OLD.team_id
  OR NEW.manager_id       IS DISTINCT FROM OLD.manager_id
  OR NEW.can_assign_tasks IS DISTINCT FROM OLD.can_assign_tasks THEN
    RAISE EXCEPTION 'Not allowed to change role, approval, team or permissions'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Drop every old policy ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "own profile read"   ON profiles;
DROP POLICY IF EXISTS "own profile update" ON profiles;
DROP POLICY IF EXISTS "admin insert"       ON profiles;
DROP POLICY IF EXISTS "admin update all"   ON profiles;
DROP POLICY IF EXISTS "staff read profiles" ON profiles;

DROP POLICY IF EXISTS "auth read active categories" ON categories;
DROP POLICY IF EXISTS "admin manage categories"     ON categories;
DROP POLICY IF EXISTS "staff manage categories"     ON categories;

DROP POLICY IF EXISTS "own logs"          ON work_logs;
DROP POLICY IF EXISTS "admin read logs"   ON work_logs;
DROP POLICY IF EXISTS "staff read logs"   ON work_logs;
DROP POLICY IF EXISTS "admin manage logs" ON work_logs;

DROP POLICY IF EXISTS "own tasks"          ON tasks;
DROP POLICY IF EXISTS "admin read tasks"   ON tasks;
DROP POLICY IF EXISTS "staff read tasks"   ON tasks;
DROP POLICY IF EXISTS "admin manage tasks" ON tasks;

DROP FUNCTION IF EXISTS is_staff();

-- ── profiles ──────────────────────────────────────────────────────────────────
-- Approved members can see the directory (names for "assigned by", pickers).
-- Unapproved users can only see themselves.
CREATE POLICY "profiles: read own"       ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles: members read"   ON profiles FOR SELECT USING (is_member());
CREATE POLICY "profiles: update own"     ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles: hr/admin update" ON profiles FOR UPDATE USING (is_hr_or_admin()) WITH CHECK (is_hr_or_admin());

-- ── teams ─────────────────────────────────────────────────────────────────────
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams: members read"     ON teams FOR SELECT USING (is_member());
CREATE POLICY "teams: hr/admin manage"  ON teams FOR ALL USING (is_hr_or_admin()) WITH CHECK (is_hr_or_admin());

-- ── categories ────────────────────────────────────────────────────────────────
CREATE POLICY "categories: members read" ON categories FOR SELECT USING (is_member());
CREATE POLICY "categories: manage"       ON categories FOR ALL
  USING (can_manage_categories()) WITH CHECK (can_manage_categories());

-- ── work_logs ─────────────────────────────────────────────────────────────────
CREATE POLICY "logs: own"        ON work_logs FOR ALL
  USING (user_id = auth.uid() AND is_member()) WITH CHECK (user_id = auth.uid() AND is_member());
CREATE POLICY "logs: viewers read" ON work_logs FOR SELECT USING (can_view_all());
CREATE POLICY "logs: admin write"  ON work_logs FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── tasks ─────────────────────────────────────────────────────────────────────
CREATE POLICY "tasks: own read"     ON tasks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "tasks: viewers read" ON tasks FOR SELECT USING (can_view_all());
CREATE POLICY "tasks: own insert"   ON tasks FOR INSERT WITH CHECK (user_id = auth.uid() AND is_member());
CREATE POLICY "tasks: own update"   ON tasks FOR UPDATE
  USING (user_id = auth.uid() AND is_member()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "tasks: own delete"   ON tasks FOR DELETE USING (user_id = auth.uid() AND is_member());
CREATE POLICY "tasks: assigners write" ON tasks FOR ALL USING (can_assign()) WITH CHECK (can_assign());
CREATE POLICY "tasks: admin write"  ON tasks FOR ALL USING (is_admin()) WITH CHECK (is_admin());
