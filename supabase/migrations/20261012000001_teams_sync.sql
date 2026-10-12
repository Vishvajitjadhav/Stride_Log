-- Microsoft Teams / Outlook calendar sync.
--
-- An admin connects Microsoft 365 once (app registration with the
-- Calendars.Read application permission). After that the teams-sync Edge
-- Function turns each person's meetings into tasks, every 30 minutes on
-- working days and whenever they open their day. People can opt out.

-- Company switch and person opt-out.
ALTER TABLE org_settings
  ADD COLUMN teams_sync_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN teams_only_online  boolean NOT NULL DEFAULT true;   -- only Teams meetings, not every calendar entry

ALTER TABLE profiles
  ADD COLUMN calendar_sync      boolean NOT NULL DEFAULT true,
  ADD COLUMN calendar_synced_at timestamptz;

-- Where a task came from, and the calendar event it mirrors (one task per
-- event occurrence per person, so syncing twice never duplicates).
ALTER TABLE tasks
  ADD COLUMN source      text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'teams')),
  ADD COLUMN external_id text;
CREATE UNIQUE INDEX tasks_external_idx ON tasks (user_id, external_id) WHERE external_id IS NOT NULL;

-- History of sync runs, shown to admins.
CREATE TABLE sync_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  trigger       text NOT NULL CHECK (trigger IN ('schedule', 'admin', 'person')),
  triggered_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  people        int NOT NULL DEFAULT 0,
  created       int NOT NULL DEFAULT 0,
  updated       int NOT NULL DEFAULT 0,
  removed       int NOT NULL DEFAULT 0,
  error         text
);
CREATE INDEX sync_runs_started_idx ON sync_runs (started_at DESC);
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_runs: hr/admin read" ON sync_runs FOR SELECT USING (is_hr_or_admin());

-- Run the sync from the database every 30 minutes, 07:30 to 20:00 IST on
-- working days (UTC schedule). Uses the same functions_url / secret as emails.
CREATE OR REPLACE FUNCTION run_teams_sync()
RETURNS void AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  IF NOT (SELECT teams_sync_enabled FROM org_settings WHERE id = 1) THEN
    RETURN;
  END IF;
  SELECT value INTO v_url    FROM private.config WHERE key = 'functions_url';
  SELECT value INTO v_secret FROM private.config WHERE key = 'email_webhook_secret';
  IF coalesce(v_url, '') = '' OR coalesce(v_secret, '') = '' THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url || '/teams-sync',
    body    := jsonb_build_object('scope', 'all', 'trigger', 'schedule'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    timeout_milliseconds := 60000
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

REVOKE EXECUTE ON FUNCTION run_teams_sync() FROM anon, authenticated, public;

DO $$
BEGIN
  PERFORM cron.schedule('stridelog-teams-sync', '*/30 2-14 * * 1-5', 'SELECT public.run_teams_sync()');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_cron not available, Teams sync schedule not created: %', SQLERRM;
END;
$$;
