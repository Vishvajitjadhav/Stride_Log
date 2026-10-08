-- Phase 6: notification emails + scheduled reminders.
--
-- Flow: a row lands in `notifications` (trigger / cron) → if the user's
-- email_prefs allow it, pg_net POSTs {notification_id} to the `send-email`
-- Edge Function, which renders the template and sends via Resend.
--
-- Configure per environment (values live in a schema the API never exposes):
--   UPDATE private.config SET value = 'https://<ref>.supabase.co/functions/v1' WHERE key = 'functions_url';
--   UPDATE private.config SET value = '<same as EMAIL_WEBHOOK_SECRET>'         WHERE key = 'email_webhook_secret';
-- If either is empty, emails are skipped silently (the in-app bell still works).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

CREATE TABLE private.config (
  key    text PRIMARY KEY,
  value  text NOT NULL DEFAULT ''
);
INSERT INTO private.config (key, value) VALUES
  -- Local default: the DB container reaches the API gateway as "kong".
  ('functions_url',        'http://kong:8000/functions/v1'),
  ('email_webhook_secret', 'local-dev-email-secret');

CREATE OR REPLACE FUNCTION dispatch_notification_email()
RETURNS TRIGGER AS $$
DECLARE
  v_url    text;
  v_secret text;
  v_pref   text;
  v_prefs  jsonb;
BEGIN
  SELECT value INTO v_url    FROM private.config WHERE key = 'functions_url';
  SELECT value INTO v_secret FROM private.config WHERE key = 'email_webhook_secret';
  IF coalesce(v_url, '') = '' OR coalesce(v_secret, '') = '' THEN
    RETURN NEW;
  END IF;

  v_pref := CASE NEW.type
    WHEN 'task_assigned'  THEN 'assigned'
    WHEN 'task_updated'   THEN 'updated'
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

CREATE TRIGGER notifications_dispatch_email
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION dispatch_notification_email();

-- ── Working-day helper ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_working_day(d date)
RETURNS boolean AS $$
  SELECT extract(isodow FROM d) < 6 AND NOT EXISTS (SELECT 1 FROM holidays WHERE date = d);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ── 6 pm reminder: "you haven't submitted today's log" ────────────────────────

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
  WHERE p.is_approved AND p.is_active
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

-- ── Monday summary of last week for managers / HR / admins ────────────────────

CREATE OR REPLACE FUNCTION send_weekly_summaries()
RETURNS int AS $$
DECLARE
  v_to    date := org_today() - extract(isodow FROM org_today())::int;  -- last Sunday
  v_from  date := v_to - 6;                                             -- last Monday
  v_stats jsonb;
  v_count int;
BEGIN
  WITH members AS (
    SELECT id FROM profiles WHERE is_approved AND is_active
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
         'Weekly summary: ' || to_char(v_from, 'DD Mon') || ' – ' || to_char(v_to, 'DD Mon'),
         (v_stats->>'done') || ' of ' || (v_stats->>'planned') || ' tasks completed',
         '/analytics?preset=last_week', v_stats
  FROM profiles p
  WHERE p.is_approved AND p.is_active AND p.role IN ('manager', 'hr', 'admin');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION send_log_reminders()     FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION send_weekly_summaries()  FROM anon, authenticated, public;

-- ── Schedules (UTC). Defaults assume IST: 18:00 IST = 12:30 UTC, Mon 09:00 IST = 03:30 UTC.

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule('stridelog-log-reminder',  '30 12 * * 1-5', 'SELECT public.send_log_reminders()');
  PERFORM cron.schedule('stridelog-weekly-summary', '30 3 * * 1',   'SELECT public.send_weekly_summaries()');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_cron not available, schedules not created: %', SQLERRM;
END;
$$;
