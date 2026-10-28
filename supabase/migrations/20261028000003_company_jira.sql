-- Company wide Jira. An admin connects their own Atlassian account and then
-- uses it for the whole company: every issue of the chosen Jira projects is
-- read, whether or not the assignee ever connected Jira.
--   * Issues of a StrideLog person become their tasks (as before).
--   * Unassigned issues, and issues of people not in StrideLog, are kept in
--     jira_issues so the board can show them.

ALTER TABLE org_settings
  ADD COLUMN jira_company_user uuid REFERENCES profiles(id) ON DELETE SET NULL;  -- whose connection reads Jira

-- Jira projects the company reads, each optionally tied to a StrideLog project.
CREATE TABLE jira_project_links (
  jira_key   text PRIMARY KEY,
  jira_name  text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE jira_project_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY jira_links_read ON jira_project_links FOR SELECT TO authenticated USING (is_member());
CREATE POLICY jira_links_write ON jira_project_links FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Open issues nobody in StrideLog owns (replaced on every company sync).
CREATE TABLE jira_issues (
  key           text PRIMARY KEY,
  title         text NOT NULL,
  status        text NOT NULL CHECK (status IN ('pending', 'in_progress', 'in_review', 'done', 'blocked')),
  status_name   text NOT NULL,
  jira_project  text,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  assignee_name text,                 -- null when unassigned
  url           text,
  due_date      date,
  updated_at    timestamptz,          -- last change in Jira
  synced_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE jira_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY jira_issues_read ON jira_issues FOR SELECT TO authenticated USING (can_view_all());

-- Last change in Jira, so the board can spot issues that stopped moving
-- (the sync touches open Jira tasks every day, so updated_at can't tell).
ALTER TABLE tasks ADD COLUMN external_updated_at timestamptz;
