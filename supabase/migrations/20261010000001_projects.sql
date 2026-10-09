-- v4: projects replace the single "team" per person.
--   • A project has members; some members are its managers.
--   • One employee can be in many projects; one manager can run many.
--   • Tasks can belong to a project, so work per project can be analysed.
--   • Managers, HR and admins create and edit projects.
-- Existing teams are converted into projects (members keep their place).

CREATE TABLE projects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL UNIQUE,
  description  text,
  color        text NOT NULL DEFAULT '#2f4e7e',
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE project_members (
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'manager')),
  added_at    timestamptz DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX project_members_user_idx ON project_members (user_id);

ALTER TABLE tasks ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX tasks_project_idx ON tasks (project_id) WHERE project_id IS NOT NULL;

-- Convert teams → projects.
INSERT INTO projects (name, created_at) SELECT name, created_at FROM teams ON CONFLICT (name) DO NOTHING;
INSERT INTO project_members (project_id, user_id, role)
SELECT pr.id, p.id, CASE WHEN t.lead_id = p.id OR p.role IN ('manager', 'admin') THEN 'manager' ELSE 'member' END
FROM profiles p JOIN teams t ON t.id = p.team_id JOIN projects pr ON pr.name = t.name
ON CONFLICT DO NOTHING;
UPDATE tasks tk SET project_id = pr.id
FROM profiles p JOIN teams t ON t.id = p.team_id JOIN projects pr ON pr.name = t.name
WHERE tk.user_id = p.id AND tk.project_id IS NULL;

-- ── Permissions ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION can_manage_projects()
RETURNS boolean AS $$
  SELECT coalesce(my_role() IN ('manager', 'hr', 'admin'), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects: members read" ON projects FOR SELECT USING (is_member());
CREATE POLICY "projects: manage"       ON projects FOR ALL USING (can_manage_projects()) WITH CHECK (can_manage_projects());

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_members: members read" ON project_members FOR SELECT USING (is_member());
CREATE POLICY "project_members: manage"       ON project_members FOR ALL USING (can_manage_projects()) WITH CHECK (can_manage_projects());

-- ── Remove teams (replaced by projects) ───────────────────────────────────────

DROP VIEW v_task_facts;
DROP VIEW v_log_facts;
ALTER TABLE profiles DROP COLUMN team_id;
DROP TABLE teams;

-- Profiles guard no longer needs to watch team_id.
CREATE OR REPLACE FUNCTION guard_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NULL OR is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Not allowed to change id or email' USING ERRCODE = '42501';
  END IF;

  IF is_hr_or_admin() THEN
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

  IF NEW.role             IS DISTINCT FROM OLD.role
  OR NEW.is_approved      IS DISTINCT FROM OLD.is_approved
  OR NEW.is_active        IS DISTINCT FROM OLD.is_active
  OR NEW.manager_id       IS DISTINCT FROM OLD.manager_id
  OR NEW.can_assign_tasks IS DISTINCT FROM OLD.can_assign_tasks THEN
    RAISE EXCEPTION 'Not allowed to change role, approval or permissions'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Analytics views (security_invoker ⇒ caller's RLS applies) ────────────────

CREATE VIEW v_task_facts WITH (security_invoker = true) AS
SELECT
  t.id,
  t.user_id,
  p.role,
  t.date,
  t.title,
  t.status,
  t.priority,
  t.category_id,
  c.name  AS category,
  c.color AS category_color,
  t.assigned_by,
  t.due_date,
  t.completed_on,
  t.project_id,
  pr.name AS project
FROM tasks t
JOIN profiles p ON p.id = t.user_id
LEFT JOIN categories c ON c.id = t.category_id
LEFT JOIN projects pr ON pr.id = t.project_id;

CREATE VIEW v_log_facts WITH (security_invoker = true) AS
SELECT
  l.user_id,
  p.role,
  l.date,
  l.submitted_at IS NOT NULL AS submitted,
  nullif(trim(l.blockers), '') AS blockers,
  nullif(trim(l.what_i_did), '') AS summary
FROM work_logs l
JOIN profiles p ON p.id = l.user_id;

-- ── Daily logging is expected from employees and BAs only ─────────────────────
-- Managers, HR and admins mainly review work; logging is optional for them.

CREATE OR REPLACE FUNCTION send_log_reminders()
RETURNS int AS $$
DECLARE
  v_today date := org_today();
  v_count int;
BEGIN
  IF NOT is_working_day(v_today) THEN
    RETURN 0;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, link, payload)
  SELECT p.id, 'log_reminder',
         'Don''t forget today''s log',
         'Take a minute to update your tasks and submit your day.',
         '/today', jsonb_build_object('date', v_today)
  FROM profiles p
  WHERE p.is_approved AND p.is_active AND p.role IN ('employee', 'ba')
    AND NOT EXISTS (
      SELECT 1 FROM work_logs l
      WHERE l.user_id = p.id AND l.date = v_today AND l.submitted_at IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = p.id AND n.type = 'log_reminder' AND n.payload->>'date' = v_today::text
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION send_weekly_summaries()
RETURNS int AS $$
DECLARE
  v_to    date := org_today() - extract(isodow FROM org_today())::int;
  v_from  date := v_to - 6;
  v_stats jsonb;
  v_count int;
BEGIN
  WITH members AS (
    SELECT id FROM profiles WHERE is_approved AND is_active AND role IN ('employee', 'ba')
  ),
  wd AS (
    SELECT d::date AS d FROM generate_series(v_from, v_to, interval '1 day') d
    WHERE is_working_day(d::date)
  ),
  t AS (
    SELECT * FROM tasks WHERE date BETWEEN v_from AND v_to AND user_id IN (SELECT id FROM members)
  ),
  l AS (
    SELECT * FROM work_logs
    WHERE date BETWEEN v_from AND v_to AND submitted_at IS NOT NULL AND user_id IN (SELECT id FROM members)
  )
  SELECT jsonb_build_object(
    'from',            v_from,
    'to',              v_to,
    'members',         (SELECT count(*) FROM members),
    'planned',         (SELECT count(*) FROM t),
    'done',            (SELECT count(*) FROM t WHERE status = 'done'),
    'blocked',         (SELECT count(*) FROM t WHERE status = 'blocked'),
    'submitted_logs',  (SELECT count(*) FROM l WHERE date IN (SELECT d FROM wd)),
    'expected_logs',   (SELECT count(*) FROM wd) * (SELECT count(*) FROM members),
    'extra_days',      (SELECT count(*) FROM l WHERE date NOT IN (SELECT d FROM wd)),
    'not_logged',      (SELECT coalesce(jsonb_agg(p.name ORDER BY p.name), '[]'::jsonb)
                        FROM profiles p
                        WHERE p.id IN (SELECT id FROM members)
                          AND NOT EXISTS (SELECT 1 FROM l WHERE l.user_id = p.id))
  ) INTO v_stats;

  INSERT INTO notifications (user_id, type, title, body, link, payload)
  SELECT p.id, 'weekly_summary',
         'Weekly summary: ' || to_char(v_from, 'DD Mon') || ' to ' || to_char(v_to, 'DD Mon'),
         (v_stats->>'done') || ' of ' || (v_stats->>'planned') || ' tasks completed',
         '/reports?preset=last_week', v_stats
  FROM profiles p
  WHERE p.is_approved AND p.is_active AND p.role IN ('manager', 'hr', 'admin');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
