-- 1. "In review" status: work that is finished by the person and waiting on
--    someone else (Jira In Review, Ready for QA, Testing).
-- 2. Task source (StrideLog, Teams, Jira) on the analytics view, so reports
--    can show or hide each source.

ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('pending', 'in_progress', 'in_review', 'done', 'blocked'));

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
  t.source
FROM tasks t
JOIN profiles p ON p.id = t.user_id
LEFT JOIN categories c ON c.id = t.category_id
LEFT JOIN projects pr ON pr.id = t.project_id;
