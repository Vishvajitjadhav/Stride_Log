-- What the Team board and the reports task table show on each task:
-- notes, the Jira key and link, and when it last changed.

CREATE OR REPLACE VIEW v_task_facts WITH (security_invoker = true) AS
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
  pr.name AS project,
  t.source,
  t.description,
  t.external_id,
  t.external_url,
  coalesce(t.external_updated_at, t.updated_at) AS changed_at
FROM tasks t
JOIN profiles p ON p.id = t.user_id
LEFT JOIN categories c ON c.id = t.category_id
LEFT JOIN projects pr ON pr.id = t.project_id;
