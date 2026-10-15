-- Connect your own account: each person signs in to Microsoft (Teams /
-- Outlook calendar) or Atlassian (Jira) once, and their meetings or issues
-- sync. No company wide admin keys.
--
-- Tokens live in oauth_connections. Row level security is on with no
-- policies and every grant is revoked, so only the Edge Functions (service
-- role) can read or write them. People see their own connection status
-- through my_connections(), which never returns tokens.

CREATE TABLE oauth_connections (
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider       text NOT NULL CHECK (provider IN ('teams', 'jira')),
  access_token   text NOT NULL,
  refresh_token  text,
  expires_at     timestamptz,
  account_email  text,                 -- who they signed in as
  account_name   text,
  cloud_id       text,                 -- Jira: which Atlassian site
  site_url       text,                 -- Jira: https://company.atlassian.net
  connected_at   timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  last_error     text,
  PRIMARY KEY (user_id, provider)
);
ALTER TABLE oauth_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON oauth_connections FROM anon, authenticated, public;

-- The caller's own connections, without tokens.
CREATE OR REPLACE FUNCTION my_connections()
RETURNS TABLE (provider text, account_email text, account_name text, site_url text, connected_at timestamptz, last_error text)
AS $$
  SELECT c.provider, c.account_email, c.account_name, c.site_url, c.connected_at, c.last_error
  FROM oauth_connections c
  WHERE c.user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION my_connections() FROM anon, public;

-- How many people have connected each app (admins, for the Integrations page).
CREATE OR REPLACE FUNCTION connection_counts()
RETURNS TABLE (provider text, people int)
AS $$
  SELECT c.provider, count(*)::int
  FROM oauth_connections c
  WHERE is_hr_or_admin()
  GROUP BY c.provider;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION connection_counts() FROM anon, public;
