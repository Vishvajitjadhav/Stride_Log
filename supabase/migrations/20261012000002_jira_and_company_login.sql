-- 1. Company email sign in: people whose email is on the company domain
--    (e.g. signing in with Microsoft) are approved as employees automatically.
-- 2. Jira sync: issues assigned to a person become tasks whose status follows
--    Jira (To do, In progress / In review, Done). Every 15 minutes, when they
--    open their day, and instantly through a Jira webhook.

ALTER TABLE org_settings
  ADD COLUMN auto_approve_domain text,                       -- e.g. 'speedinnovations.in'
  ADD COLUMN jira_sync_enabled   boolean NOT NULL DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN jira_sync       boolean NOT NULL DEFAULT true,
  ADD COLUMN jira_account_id text,
  ADD COLUMN jira_synced_at  timestamptz;
CREATE UNIQUE INDEX profiles_jira_account_idx ON profiles (jira_account_id) WHERE jira_account_id IS NOT NULL;

ALTER TABLE tasks DROP CONSTRAINT tasks_source_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_source_check CHECK (source IN ('manual', 'teams', 'jira'));
ALTER TABLE tasks ADD COLUMN external_url text;              -- link back to the Jira issue

ALTER TABLE sync_runs ADD COLUMN source text NOT NULL DEFAULT 'teams' CHECK (source IN ('teams', 'jira'));
ALTER TABLE sync_runs DROP CONSTRAINT sync_runs_trigger_check;
ALTER TABLE sync_runs ADD CONSTRAINT sync_runs_trigger_check CHECK (trigger IN ('schedule', 'admin', 'person', 'webhook'));

-- New sign ups: approved automatically when on the company domain.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_domain text := lower(nullif(trim((SELECT auto_approve_domain FROM org_settings WHERE id = 1)), ''));
  v_name   text := coalesce(nullif(NEW.raw_user_meta_data->>'name', ''), nullif(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1));
BEGIN
  INSERT INTO profiles (id, name, email, role, avatar_initials, is_approved)
  VALUES (
    NEW.id,
    v_name,
    NEW.email,
    'employee',
    UPPER(LEFT(v_name, 2)),
    v_domain IS NOT NULL AND lower(split_part(NEW.email, '@', 2)) = v_domain
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Scheduler entry point for Jira (same secret / URL as e-mail and Teams).
CREATE OR REPLACE FUNCTION run_jira_sync()
RETURNS void AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  IF NOT (SELECT jira_sync_enabled FROM org_settings WHERE id = 1) THEN
    RETURN;
  END IF;
  SELECT value INTO v_url    FROM private.config WHERE key = 'functions_url';
  SELECT value INTO v_secret FROM private.config WHERE key = 'email_webhook_secret';
  IF coalesce(v_url, '') = '' OR coalesce(v_secret, '') = '' THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url || '/jira-sync',
    body    := jsonb_build_object('scope', 'all', 'trigger', 'schedule'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    timeout_milliseconds := 60000
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;
REVOKE EXECUTE ON FUNCTION run_jira_sync() FROM anon, authenticated, public;

DO $$
BEGIN
  PERFORM cron.schedule('stridelog-jira-sync', '*/15 2-14 * * 1-5', 'SELECT public.run_jira_sync()');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_cron not available, Jira sync schedule not created: %', SQLERRM;
END;
$$;

-- The Jira account link decides whose issues land in your day, so only the
-- sync (service role) or an admin may set it.
CREATE OR REPLACE FUNCTION guard_jira_account()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin() AND NEW.jira_account_id IS DISTINCT FROM OLD.jira_account_id THEN
    RAISE EXCEPTION 'Not allowed to change the Jira link' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER profiles_guard_jira BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_jira_account();
