-- Team page and detailed reports show each person's daily summary note.
-- (New column appended at the end so CREATE OR REPLACE VIEW is allowed.)
CREATE OR REPLACE VIEW v_log_facts WITH (security_invoker = true) AS
SELECT
  l.user_id,
  p.team_id,
  p.role,
  l.date,
  l.submitted_at IS NOT NULL AS submitted,
  nullif(trim(l.blockers), '') AS blockers,
  nullif(trim(l.what_i_did), '') AS summary
FROM work_logs l
JOIN profiles p ON p.id = l.user_id;

-- Calmer default category colours for a corporate look (only where the
-- original bright default is still in use; custom colours are kept).
UPDATE categories SET color = v.new FROM (VALUES
  ('Development',   '#7c3aed', '#2f4e7e'),
  ('Brainstorming', '#f97316', '#b8902f'),
  ('Team Meeting',  '#f59e0b', '#8a6a1f'),
  ('Scrum Call',    '#eab308', '#a3873b'),
  ('Interview',     '#06b6d4', '#2c7a7b'),
  ('Client Call',   '#0ea5e9', '#3b6e8f'),
  ('Design',        '#ec4899', '#9d4f6e'),
  ('Testing',       '#10b981', '#3f7d5c'),
  ('Code Review',   '#8b5cf6', '#5b5f97'),
  ('Documentation', '#3b82f6', '#4a6ca3'),
  ('Research',      '#14b8a6', '#4f8a83'),
  ('Training',      '#84cc16', '#6b8e3d'),
  ('Support',       '#ef4444', '#a84a3f')
) AS v(name, old, new)
WHERE categories.name = v.name AND lower(categories.color) = v.old;
