-- Phase 2/3: connected tasks & assignment, no hours, categories, holidays,
-- company settings, notifications, analytics views.

-- ── Company settings (single row) ─────────────────────────────────────────────

CREATE TABLE org_settings (
  id             int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name   text NOT NULL DEFAULT 'StrideLog',
  logo_url       text,
  timezone       text NOT NULL DEFAULT 'Asia/Kolkata',
  week_start     int  NOT NULL DEFAULT 1 CHECK (week_start IN (0, 1)),  -- 0 = Sun, 1 = Mon
  report_footer  text NOT NULL DEFAULT 'Confidential — for internal use only',
  app_url        text NOT NULL DEFAULT 'http://localhost:5173',
  updated_at     timestamptz DEFAULT now()
);
INSERT INTO org_settings (id) VALUES (1);

ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;
-- Public read: the login page and PWA show the company name/logo before sign-in.
CREATE POLICY "org: public read"  ON org_settings FOR SELECT USING (true);
CREATE POLICY "org: admin update" ON org_settings FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- "Today" in the company's timezone (used by triggers and cron jobs).
CREATE OR REPLACE FUNCTION org_today()
RETURNS date AS $$
  SELECT (now() AT TIME ZONE (SELECT timezone FROM org_settings WHERE id = 1))::date;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ── Holidays ──────────────────────────────────────────────────────────────────

CREATE TABLE holidays (
  date        date PRIMARY KEY,
  name        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holidays: members read"    ON holidays FOR SELECT USING (is_member());
CREATE POLICY "holidays: hr/admin manage" ON holidays FOR ALL USING (is_hr_or_admin()) WITH CHECK (is_hr_or_admin());

-- ── Tasks: connected daily list + assignment ──────────────────────────────────

ALTER TABLE tasks
  ADD COLUMN date         date,
  ADD COLUMN description  text,
  ADD COLUMN priority     text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  ADD COLUMN due_date     date,
  ADD COLUMN assigned_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN updated_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN updated_at   timestamptz DEFAULT now(),
  ADD COLUMN completed_on date;

UPDATE tasks t SET date = l.date FROM work_logs l WHERE l.id = t.log_id;
UPDATE tasks SET completed_on = date WHERE status = 'done';
ALTER TABLE tasks ALTER COLUMN date SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN date SET DEFAULT CURRENT_DATE;
ALTER TABLE tasks ALTER COLUMN log_id DROP NOT NULL;

-- No time tracking: hours are removed on purpose (see PLAN.md principles).
ALTER TABLE tasks DROP COLUMN hours;

ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('pending', 'in_progress', 'done', 'blocked'));

CREATE INDEX tasks_user_date_idx ON tasks (user_id, date);
CREATE INDEX tasks_date_idx      ON tasks (date);
CREATE INDEX tasks_open_idx      ON tasks (user_id) WHERE status <> 'done';
CREATE INDEX tasks_assigned_by_idx ON tasks (assigned_by) WHERE assigned_by IS NOT NULL;
CREATE INDEX work_logs_date_idx  ON work_logs (date);

-- Keep every task attached to its owner's work_log for that date (creating the
-- log if needed), stamp who changed it, and track the completion date. Runs as
-- definer so a manager assigning a task can create the assignee's log row.
CREATE OR REPLACE FUNCTION tasks_before_write()
RETURNS TRIGGER AS $$
DECLARE
  v_log_id uuid;
BEGIN
  IF TG_OP = 'INSERT' AND current_setting('stridelog.importing', true) = 'on' THEN
    NEW.assigned_by := NULL;               -- historical import, not an assignment
  ELSIF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL AND NEW.user_id <> auth.uid() THEN
      NEW.assigned_by := auth.uid();       -- can't be spoofed by the client
    ELSIF auth.uid() IS NOT NULL THEN
      NEW.assigned_by := NULL;
    END IF;
  ELSE
    NEW.assigned_by := OLD.assigned_by;    -- immutable after creation
  END IF;

  IF TG_OP = 'INSERT' OR NEW.date IS DISTINCT FROM OLD.date OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    INSERT INTO work_logs (user_id, date) VALUES (NEW.user_id, NEW.date)
      ON CONFLICT (user_id, date) DO NOTHING;
    SELECT id INTO v_log_id FROM work_logs WHERE user_id = NEW.user_id AND date = NEW.date;
    NEW.log_id := v_log_id;
  END IF;

  IF NEW.status = 'done' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_on := coalesce(NEW.completed_on, org_today());
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_on := NULL;
  END IF;

  NEW.updated_by := coalesce(auth.uid(), NEW.updated_by);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tasks_before_write
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION tasks_before_write();

-- Bulk import of a spreadsheet (one transaction, no notifications).
-- Runs as the caller, so RLS decides whose data they may import into.
-- p_days: [{ date, what_i_did, tasks: [{ title, status, category_id }] }]
CREATE OR REPLACE FUNCTION import_work(p_user_id uuid, p_days jsonb)
RETURNS jsonb AS $$
DECLARE
  v_day   jsonb;
  v_task  jsonb;
  v_logs  int := 0;
  v_tasks int := 0;
BEGIN
  PERFORM set_config('stridelog.importing', 'on', true);

  FOR v_day IN SELECT * FROM jsonb_array_elements(p_days) LOOP
    INSERT INTO work_logs (user_id, date, what_i_did, submitted_at)
    VALUES (p_user_id, (v_day->>'date')::date, nullif(v_day->>'what_i_did', ''), now())
    ON CONFLICT (user_id, date) DO UPDATE
      SET what_i_did   = coalesce(EXCLUDED.what_i_did, work_logs.what_i_did),
          submitted_at = coalesce(work_logs.submitted_at, EXCLUDED.submitted_at);
    v_logs := v_logs + 1;

    FOR v_task IN SELECT * FROM jsonb_array_elements(coalesce(v_day->'tasks', '[]'::jsonb)) LOOP
      INSERT INTO tasks (user_id, date, title, status, category_id, completed_on)
      VALUES (p_user_id, (v_day->>'date')::date, v_task->>'title', v_task->>'status',
              nullif(v_task->>'category_id', '')::uuid,
              CASE WHEN v_task->>'status' = 'done' THEN (v_day->>'date')::date END);
      v_tasks := v_tasks + 1;
    END LOOP;
  END LOOP;

  PERFORM set_config('stridelog.importing', 'off', true);
  RETURN jsonb_build_object('logsCreated', v_logs, 'tasksCreated', v_tasks);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- Employees may not delete tasks someone else assigned to them.
DROP POLICY "tasks: own delete" ON tasks;
CREATE POLICY "tasks: own delete" ON tasks FOR DELETE
  USING (user_id = auth.uid() AND assigned_by IS NULL AND is_member());

-- ── Categories: no-micromanagement defaults ───────────────────────────────────

ALTER TABLE categories ADD CONSTRAINT categories_name_key UNIQUE (name);
UPDATE categories SET name = 'Code Review' WHERE name = 'Review'
  AND NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Code Review');
UPDATE categories SET name = 'Team Meeting' WHERE name = 'Meeting'
  AND NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Team Meeting');

INSERT INTO categories (name, color) VALUES
  ('Development',   '#7c3aed'),
  ('Brainstorming', '#f97316'),
  ('Team Meeting',  '#f59e0b'),
  ('Scrum Call',    '#eab308'),
  ('Interview',     '#06b6d4'),
  ('Client Call',   '#0ea5e9'),
  ('Design',        '#ec4899'),
  ('Testing',       '#10b981'),
  ('Code Review',   '#8b5cf6'),
  ('Documentation', '#3b82f6'),
  ('Research',      '#14b8a6'),
  ('Training',      '#84cc16'),
  ('Support',       '#ef4444')
ON CONFLICT (name) DO NOTHING;

-- ── Notifications (in-app bell; also drives emails) ───────────────────────────

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('task_assigned', 'task_updated', 'account_approved', 'log_reminder', 'weekly_summary')),
  title       text NOT NULL,
  body        text,
  link        text,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at     timestamptz,
  emailed_at  timestamptz,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications: own read"   ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications: own update" ON notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications: own delete" ON notifications FOR DELETE USING (user_id = auth.uid());
-- Inserts only happen from SECURITY DEFINER triggers / cron / service role.

CREATE OR REPLACE FUNCTION notify_task_change()
RETURNS TRIGGER AS $$
DECLARE
  v_actor text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = NEW.user_id
     OR current_setting('stridelog.importing', true) = 'on' THEN
    RETURN NEW;
  END IF;
  SELECT name INTO v_actor FROM profiles WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO notifications (user_id, type, title, body, link, payload)
    VALUES (NEW.user_id, 'task_assigned',
            v_actor || ' assigned you a task',
            NEW.title, '/today',
            jsonb_build_object('task_id', NEW.id, 'actor', v_actor, 'due_date', NEW.due_date,
                               'priority', NEW.priority, 'description', NEW.description, 'date', NEW.date));
  ELSIF (NEW.title, NEW.status, NEW.due_date, NEW.date, NEW.priority, NEW.description)
        IS DISTINCT FROM (OLD.title, OLD.status, OLD.due_date, OLD.date, OLD.priority, OLD.description) THEN
    INSERT INTO notifications (user_id, type, title, body, link, payload)
    VALUES (NEW.user_id, 'task_updated',
            v_actor || ' updated your task',
            NEW.title, '/today',
            jsonb_build_object('task_id', NEW.id, 'actor', v_actor, 'status', NEW.status,
                               'old_status', OLD.status, 'due_date', NEW.due_date, 'date', NEW.date));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tasks_notify
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_task_change();

CREATE OR REPLACE FUNCTION notify_profile_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_approved AND NOT OLD.is_approved THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (NEW.id, 'account_approved', 'Your account was approved',
            'Welcome aboard! You can now log your daily work.', '/today');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER profiles_notify_approved
  AFTER UPDATE OF is_approved ON profiles
  FOR EACH ROW EXECUTE FUNCTION notify_profile_approved();

-- ── Realtime: assignments appear instantly in "My Day" ────────────────────────

ALTER TABLE tasks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ── Analytics views (security_invoker => caller's RLS applies) ────────────────

CREATE VIEW v_task_facts WITH (security_invoker = true) AS
SELECT
  t.id,
  t.user_id,
  p.team_id,
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
  t.completed_on
FROM tasks t
JOIN profiles p ON p.id = t.user_id
LEFT JOIN categories c ON c.id = t.category_id;

CREATE VIEW v_log_facts WITH (security_invoker = true) AS
SELECT
  l.user_id,
  p.team_id,
  p.role,
  l.date,
  l.submitted_at IS NOT NULL AS submitted,
  nullif(trim(l.blockers), '') AS blockers
FROM work_logs l
JOIN profiles p ON p.id = l.user_id;

-- ── Branding bucket for the company logo ──────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('branding', 'branding', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "branding: public read"  ON storage.objects FOR SELECT USING (bucket_id = 'branding');
CREATE POLICY "branding: admin insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'branding' AND public.is_admin());
CREATE POLICY "branding: admin update" ON storage.objects FOR UPDATE USING (bucket_id = 'branding' AND public.is_admin());
CREATE POLICY "branding: admin delete" ON storage.objects FOR DELETE USING (bucket_id = 'branding' AND public.is_admin());
