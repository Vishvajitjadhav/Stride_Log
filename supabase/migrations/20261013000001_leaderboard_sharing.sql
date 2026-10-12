-- Team sharing and a healthy leaderboard.
--
-- 1. Managers and admins decide what employees can see:
--      team_tasks_visible  : everyone's tasks, read only (on by default)
--      leaderboard_visible : the recognition board (off by default)
--    Daily notes and blockers (work_logs) always stay private to managers.
-- 2. leaderboard(from, to) scores people on rates, never on task counts,
--    so someone with a few large tasks is not beaten by someone with many
--    small ones:
--      Consistency     30%  working days with a submitted daily log
--      Follow-through  30%  planned tasks (up to today) that were finished
--      On time         25%  assigned tasks with a due date finished by it
--                           (counted once at least two were due)
--      Growth          15%  change in consistency and follow-through vs the
--                           previous period of the same length (50 = steady)
--    A part with no data is left out and the others are re-weighted.
--    Weekend work earns nothing, so the board never rewards overwork.
--    Employees only receive the top five, badge winners and their own row.

ALTER TABLE org_settings
  ADD COLUMN team_tasks_visible  boolean NOT NULL DEFAULT true,
  ADD COLUMN leaderboard_visible boolean NOT NULL DEFAULT false;

-- Everyone can read the team's tasks when sharing is on (writes are unchanged).
CREATE POLICY "tasks: team read" ON tasks FOR SELECT
  USING (is_member() AND (SELECT team_tasks_visible FROM org_settings WHERE id = 1));

-- Managers (not only admins) may change the two sharing switches.
CREATE OR REPLACE FUNCTION set_team_sharing(p_tasks boolean DEFAULT NULL, p_leaderboard boolean DEFAULT NULL)
RETURNS void AS $$
BEGIN
  IF coalesce(my_role(), '') NOT IN ('manager', 'admin') THEN
    RAISE EXCEPTION 'Only managers and admins can change team sharing' USING ERRCODE = '42501';
  END IF;
  UPDATE org_settings SET
    team_tasks_visible  = coalesce(p_tasks, team_tasks_visible),
    leaderboard_visible = coalesce(p_leaderboard, leaderboard_visible),
    updated_at = now()
  WHERE id = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION set_team_sharing(boolean, boolean) FROM anon, public;

-- Raw rates for one person and one period (NULL when there is nothing to measure).
CREATE OR REPLACE FUNCTION person_rates(p_user uuid, p_joined date, p_from date, p_to date, p_today date,
  OUT expected int, OUT logged int, OUT planned int, OUT done int, OUT due int, OUT on_time int)
AS $$
DECLARE
  v_end date := least(p_to, p_today);
BEGIN
  SELECT count(*) INTO expected
  FROM generate_series(greatest(p_from, p_joined), v_end, interval '1 day') d
  WHERE is_working_day(d::date);

  SELECT count(*) INTO logged
  FROM work_logs w
  WHERE w.user_id = p_user AND w.submitted_at IS NOT NULL
    AND w.date BETWEEN p_from AND v_end AND is_working_day(w.date);

  SELECT count(*), count(*) FILTER (WHERE t.status = 'done') INTO planned, done
  FROM tasks t
  WHERE t.user_id = p_user AND t.date BETWEEN p_from AND v_end;

  SELECT count(*), count(*) FILTER (WHERE t.status = 'done' AND t.completed_on <= t.due_date) INTO due, on_time
  FROM tasks t
  WHERE t.user_id = p_user AND t.assigned_by IS NOT NULL AND t.due_date IS NOT NULL
    AND t.date BETWEEN p_from AND p_to
    AND (t.status = 'done' OR t.due_date < p_today);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION person_rates(uuid, date, date, date, date) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION leaderboard(p_from date, p_to date)
RETURNS TABLE (
  user_id uuid, name text, avatar_url text, avatar_initials text,
  score int, consistency int, follow_through int, on_time int, growth int,
  logged_days int, expected_days int, planned int, done int, on_time_base int,
  eligible boolean, rank int, badges text[], is_me boolean
) AS $$
#variable_conflict use_column
DECLARE
  v_today date := org_today();
  v_full  boolean := can_view_all();
  v_len   int := p_to - p_from + 1;
BEGIN
  IF NOT is_member() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT v_full AND NOT (SELECT leaderboard_visible FROM org_settings WHERE id = 1) THEN
    RAISE EXCEPTION 'The leaderboard is not shared with the team' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH people AS (
    SELECT p.id, p.name, p.avatar_url, p.avatar_initials,
           least(p.created_at::date, coalesce((SELECT min(w.date) FROM work_logs w WHERE w.user_id = p.id), p.created_at::date)) AS joined
    FROM profiles p
    WHERE p.is_approved AND p.is_active AND p.role IN ('employee', 'ba')
  ),
  raw AS (
    SELECT pe.*, c.*,
           pv.expected AS p_expected, pv.logged AS p_logged, pv.planned AS p_planned, pv.done AS p_done
    FROM people pe
    CROSS JOIN LATERAL person_rates(pe.id, pe.joined, p_from, p_to, v_today) c
    CROSS JOIN LATERAL person_rates(pe.id, pe.joined, p_from - v_len, p_from - 1, v_today) pv
  ),
  rates AS (
    SELECT r.*,
      CASE WHEN r.expected > 0 THEN least(100, round(100.0 * r.logged / r.expected))::int END AS c_rate,
      CASE WHEN r.planned  > 0 THEN round(100.0 * r.done / r.planned)::int END AS f_rate,
      CASE WHEN r.due     >= 2 THEN round(100.0 * r.on_time / r.due)::int END AS o_rate,
      CASE WHEN r.p_expected > 0 AND r.p_planned > 0 AND r.expected > 0 AND r.planned > 0 THEN
        greatest(0, least(100, round(50 + 1.25 * (
          (least(100, 100.0 * r.logged / r.expected) + 100.0 * r.done / r.planned) / 2
          - (least(100, 100.0 * r.p_logged / r.p_expected) + 100.0 * r.p_done / r.p_planned) / 2))))::int
      END AS g_rate
    FROM raw r
  ),
  scored AS (
    SELECT s.*,
      (s.expected >= 3 AND s.planned >= 3) AS ok,
      round(
        (coalesce(0.30 * s.c_rate, 0) + coalesce(0.30 * s.f_rate, 0) + coalesce(0.25 * s.o_rate, 0) + coalesce(0.15 * s.g_rate, 0))
        / nullif((CASE WHEN s.c_rate IS NULL THEN 0 ELSE 0.30 END) + (CASE WHEN s.f_rate IS NULL THEN 0 ELSE 0.30 END)
               + (CASE WHEN s.o_rate IS NULL THEN 0 ELSE 0.25 END) + (CASE WHEN s.g_rate IS NULL THEN 0 ELSE 0.15 END), 0)
      )::int AS total
    FROM rates s
  ),
  ranked AS (
    SELECT s.*,
      CASE WHEN s.ok THEN rank() OVER (PARTITION BY s.ok ORDER BY s.total DESC NULLS LAST, s.c_rate DESC NULLS LAST)::int END AS pos,
      max(s.c_rate) FILTER (WHERE s.ok) OVER () AS best_c,
      max(s.f_rate) FILTER (WHERE s.ok) OVER () AS best_f,
      max(s.o_rate) FILTER (WHERE s.ok AND s.due >= 2) OVER () AS best_o,
      max(s.g_rate) FILTER (WHERE s.ok) OVER () AS best_g
    FROM scored s
  ),
  out AS (
    SELECT r.*,
      array_remove(ARRAY[
        CASE WHEN r.ok AND r.c_rate = r.best_c AND r.c_rate >= 80 THEN 'consistent' END,
        CASE WHEN r.ok AND r.f_rate = r.best_f AND r.f_rate >= 70 THEN 'finisher' END,
        CASE WHEN r.ok AND r.due >= 2 AND r.o_rate = r.best_o AND r.o_rate >= 70 THEN 'reliable' END,
        CASE WHEN r.ok AND r.g_rate = r.best_g AND r.g_rate > 55 THEN 'improved' END
      ], NULL) AS b
    FROM ranked r
  )
  SELECT o.id, o.name, o.avatar_url, o.avatar_initials,
         o.total, o.c_rate, o.f_rate, o.o_rate, o.g_rate,
         o.logged, o.expected, o.planned, o.done, o.due,
         o.ok, o.pos, o.b, o.id = auth.uid()
  FROM out o
  WHERE v_full OR o.id = auth.uid() OR o.pos <= 5 OR cardinality(o.b) > 0
  ORDER BY o.pos NULLS LAST, o.name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION leaderboard(date, date) FROM anon, public;

-- Only the main events are e-mailed (assignment, evening reminder, weekly
-- summary, account approval). Task updates stay in the app's bell.
CREATE OR REPLACE FUNCTION dispatch_notification_email()
RETURNS TRIGGER AS $$
DECLARE
  v_url    text;
  v_secret text;
  v_pref   text;
  v_prefs  jsonb;
BEGIN
  IF NEW.type = 'task_updated' THEN
    RETURN NEW;
  END IF;
  SELECT value INTO v_url    FROM private.config WHERE key = 'functions_url';
  SELECT value INTO v_secret FROM private.config WHERE key = 'email_webhook_secret';
  IF coalesce(v_url, '') = '' OR coalesce(v_secret, '') = '' THEN
    RETURN NEW;
  END IF;

  v_pref := CASE NEW.type
    WHEN 'task_assigned'  THEN 'assigned'
    WHEN 'log_reminder'   THEN 'reminder'
    WHEN 'weekly_summary' THEN 'weekly'
    ELSE NULL                                -- account_approved: always send
  END;
  SELECT email_prefs INTO v_prefs FROM profiles WHERE id = NEW.user_id;
  IF v_pref IS NOT NULL AND coalesce((v_prefs->>v_pref)::boolean, true) = false THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/send-email',
    body    := jsonb_build_object('notification_id', NEW.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'email dispatch failed: %', SQLERRM;  -- never block the write
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;
