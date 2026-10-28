-- No more "Submit day". A day becomes Active on its own when the person works:
-- adds or changes one of their tasks, finishes a task, a Jira issue they own
-- moves, or a Teams meeting of theirs takes place. Notes saved on My Day mark
-- the day too (the app sets submitted_at when notes are saved).
--
-- Active is stored in the existing work_logs.submitted_at, so every report,
-- the leaderboard and the evening reminder keep working unchanged.

CREATE OR REPLACE FUNCTION mark_day_active()
RETURNS TRIGGER AS $$
DECLARE
  v_today date := org_today();
  v_day   date;
BEGIN
  -- History brought in by the importer is logged by the import itself.
  IF current_setting('stridelog.importing', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.source = 'teams' THEN
    -- A meeting counts once it has happened.
    IF NEW.status <> 'done' OR (TG_OP = 'UPDATE' AND OLD.status = 'done') THEN RETURN NEW; END IF;
    v_day := NEW.date;
  ELSIF NEW.source = 'jira' THEN
    -- New issue or a status change; the daily move to "today" is not work.
    IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
    v_day := CASE WHEN NEW.status = 'done' THEN coalesce(NEW.completed_on, v_today) ELSE v_today END;
  ELSE
    -- Only the person's own changes count, not a manager editing their task.
    IF auth.uid() IS NOT NULL AND auth.uid() <> NEW.user_id THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.title IS NOT DISTINCT FROM OLD.title
       AND NEW.description IS NOT DISTINCT FROM OLD.description THEN
      RETURN NEW;
    END IF;
    -- A task logged for an earlier day counts for that day.
    v_day := CASE WHEN NEW.status = 'done' AND NEW.completed_on IS NOT NULL THEN NEW.completed_on
                  ELSE least(NEW.date, v_today) END;
  END IF;

  IF v_day IS NULL OR v_day > v_today THEN RETURN NEW; END IF;

  INSERT INTO work_logs (user_id, date, submitted_at)
  VALUES (NEW.user_id, v_day, now())
  ON CONFLICT (user_id, date) DO UPDATE
    SET submitted_at = coalesce(work_logs.submitted_at, EXCLUDED.submitted_at)
    WHERE work_logs.submitted_at IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tasks_mark_day_active
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION mark_day_active();

-- History: days with real work before this change count as Active too, so
-- nobody shows "No activity" for a day they finished tasks but never pressed
-- Submit. Same rules as the trigger, one time.
INSERT INTO work_logs (user_id, date, submitted_at)
SELECT DISTINCT a.user_id, a.day, now()
FROM (
  SELECT user_id, completed_on AS day FROM tasks WHERE completed_on IS NOT NULL
  UNION
  SELECT user_id, (created_at AT TIME ZONE (SELECT timezone FROM org_settings WHERE id = 1))::date FROM tasks WHERE source = 'manual'
  UNION
  SELECT user_id, date FROM tasks WHERE source = 'teams' AND status = 'done'
) a
WHERE a.day <= org_today()
ON CONFLICT (user_id, date) DO UPDATE
  SET submitted_at = coalesce(work_logs.submitted_at, EXCLUDED.submitted_at)
  WHERE work_logs.submitted_at IS NULL;
