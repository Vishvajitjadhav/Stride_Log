-- Role & permission tests. Run with:  npx supabase test db
-- Each block switches to a user via request.jwt.claims, exactly like PostgREST.
BEGIN;
SELECT plan(32);

-- ── Fixtures ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.mk_user(p_id uuid, p_email text, p_role text, p_approved bool DEFAULT true)
RETURNS void AS $$
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
  VALUES (p_id, p_email, jsonb_build_object('name', split_part(p_email, '@', 1)), 'authenticated', 'authenticated');
  UPDATE public.profiles SET role = p_role, is_approved = p_approved WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.act_as(p_id uuid) RETURNS void AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.as_postgres() RETURNS void AS $$
BEGIN
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);
END;
$$ LANGUAGE plpgsql;

SELECT pg_temp.mk_user('00000000-0000-0000-0000-0000000000e1', 'emp1@test.dev', 'employee');
SELECT pg_temp.mk_user('00000000-0000-0000-0000-0000000000e2', 'emp2@test.dev', 'employee');
SELECT pg_temp.mk_user('00000000-0000-0000-0000-0000000000b1', 'ba@test.dev', 'ba');
SELECT pg_temp.mk_user('00000000-0000-0000-0000-0000000000a1', 'mgr@test.dev', 'manager');
SELECT pg_temp.mk_user('00000000-0000-0000-0000-0000000000c1', 'hr@test.dev', 'hr');
SELECT pg_temp.mk_user('00000000-0000-0000-0000-0000000000d1', 'admin@test.dev', 'admin');
SELECT pg_temp.mk_user('00000000-0000-0000-0000-0000000000f1', 'new@test.dev', 'employee', false);

INSERT INTO tasks (id, user_id, title, status, date)
VALUES ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e2', 'emp2 secret task', 'pending', CURRENT_DATE);

-- ── Employee ──────────────────────────────────────────────────────────────────
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');

SELECT throws_ok(
  $$ UPDATE profiles SET role = 'admin' WHERE id = '00000000-0000-0000-0000-0000000000e1' $$,
  '42501', NULL, 'employee cannot make themselves admin');
SELECT throws_ok(
  $$ UPDATE profiles SET can_assign_tasks = true WHERE id = '00000000-0000-0000-0000-0000000000e1' $$,
  '42501', NULL, 'employee cannot grant themselves assignment');
SELECT lives_ok(
  $$ UPDATE profiles SET name = 'Emp One' WHERE id = '00000000-0000-0000-0000-0000000000e1' $$,
  'employee can rename themselves');
SELECT is((SELECT count(*)::int FROM tasks WHERE user_id = '00000000-0000-0000-0000-0000000000e2'), 0,
  'employee cannot see a colleague''s tasks');
SELECT is((SELECT count(*)::int FROM v_task_facts WHERE user_id = '00000000-0000-0000-0000-0000000000e2'), 0,
  'analytics view respects RLS');
SELECT throws_ok(
  $$ INSERT INTO tasks (user_id, title, status) VALUES ('00000000-0000-0000-0000-0000000000e2', 'x', 'pending') $$,
  '42501', NULL, 'employee cannot create tasks for others');
SELECT lives_ok(
  $$ INSERT INTO tasks (id, user_id, title, status) VALUES ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', 'my task', 'pending') $$,
  'employee can create own task');
SELECT is((SELECT count(*)::int FROM work_logs WHERE user_id = '00000000-0000-0000-0000-0000000000e1' AND date = CURRENT_DATE), 1,
  'creating a task attaches it to (and creates) the day''s log');
SELECT throws_ok(
  $$ INSERT INTO categories (name) VALUES ('Nope') $$, '42501', NULL, 'employee cannot add categories');
SELECT is((SELECT count(*)::int FROM org_settings), 1, 'employee can read company settings');
SELECT is_empty(
  $$ UPDATE org_settings SET company_name = 'Hacked' WHERE id = 1 RETURNING 1 $$,
  'employee cannot change company settings');
SELECT is((import_work('00000000-0000-0000-0000-0000000000e1',
  '[{"date":"2026-01-05","tasks":[{"title":"old","status":"done"}]}]'::jsonb)->>'tasksCreated')::int, 1,
  'employee can import into their own history');
SELECT throws_ok(
  $$ SELECT import_work('00000000-0000-0000-0000-0000000000e2', '[{"date":"2026-01-05","tasks":[]}]'::jsonb) $$,
  '42501', NULL, 'employee cannot import into someone else');

-- ── Unapproved sign-up ────────────────────────────────────────────────────────
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
SELECT throws_ok(
  $$ UPDATE profiles SET is_approved = true WHERE id = '00000000-0000-0000-0000-0000000000f1' $$,
  '42501', NULL, 'unapproved user cannot approve themselves');
SELECT throws_ok(
  $$ INSERT INTO tasks (user_id, title, status) VALUES ('00000000-0000-0000-0000-0000000000f1', 'x', 'pending') $$,
  '42501', NULL, 'unapproved user cannot log tasks');
SELECT is((SELECT count(*)::int FROM profiles), 1, 'unapproved user only sees their own profile');

-- ── BA without the permission ─────────────────────────────────────────────────
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
SELECT throws_ok(
  $$ INSERT INTO tasks (user_id, title, status) VALUES ('00000000-0000-0000-0000-0000000000e1', 'x', 'pending') $$,
  '42501', NULL, 'BA cannot assign until granted');

-- ── Manager: sees everyone, assigns & edits ───────────────────────────────────
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
SELECT is((SELECT count(*)::int FROM tasks WHERE user_id = '00000000-0000-0000-0000-0000000000e2'), 1,
  'manager sees everyone''s tasks');
SELECT lives_ok(
  $$ INSERT INTO tasks (id, user_id, title, status, assigned_by)
     VALUES ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 'Prepare demo', 'pending',
             '00000000-0000-0000-0000-0000000000e2') $$,
  'manager can assign a task');
SELECT lives_ok(
  $$ UPDATE tasks SET due_date = CURRENT_DATE + 1 WHERE id = '10000000-0000-0000-0000-000000000002' $$,
  'manager can edit someone''s task');

SELECT pg_temp.as_postgres();
SELECT is((SELECT assigned_by FROM tasks WHERE id = '10000000-0000-0000-0000-0000000000a1'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'assigned_by is stamped server-side (client value ignored)');
SELECT is((SELECT count(*)::int FROM notifications WHERE user_id = '00000000-0000-0000-0000-0000000000e1' AND type = 'task_assigned'), 1,
  'assignee is notified');
SELECT is((SELECT count(*)::int FROM notifications WHERE user_id = '00000000-0000-0000-0000-0000000000e2' AND type = 'task_updated'), 1,
  'owner is notified when a manager edits their task');

-- ── Employee vs an assigned task ──────────────────────────────────────────────
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
SELECT lives_ok(
  $$ UPDATE tasks SET status = 'done' WHERE id = '10000000-0000-0000-0000-0000000000a1' $$,
  'employee can complete an assigned task');
SELECT is_empty(
  $$ DELETE FROM tasks WHERE id = '10000000-0000-0000-0000-0000000000a1' RETURNING 1 $$,
  'employee cannot delete an assigned task');

-- ── HR ────────────────────────────────────────────────────────────────────────
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
SELECT lives_ok(
  $$ UPDATE profiles SET is_approved = true WHERE id = '00000000-0000-0000-0000-0000000000f1' $$,
  'HR can approve a sign-up');
SELECT throws_ok(
  $$ UPDATE profiles SET role = 'admin' WHERE id = '00000000-0000-0000-0000-0000000000e1' $$,
  '42501', NULL, 'HR cannot create admins');
SELECT throws_ok(
  $$ UPDATE profiles SET can_assign_tasks = true WHERE id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', NULL, 'HR cannot grant task assignment');
SELECT throws_ok(
  $$ INSERT INTO tasks (user_id, title, status) VALUES ('00000000-0000-0000-0000-0000000000e1', 'x', 'pending') $$,
  '42501', NULL, 'HR cannot assign tasks');

-- ── Admin grants the BA permission ────────────────────────────────────────────
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
SELECT lives_ok(
  $$ UPDATE profiles SET can_assign_tasks = true WHERE id = '00000000-0000-0000-0000-0000000000b1' $$,
  'admin can grant task assignment');

SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
SELECT lives_ok(
  $$ INSERT INTO tasks (user_id, title, status) VALUES ('00000000-0000-0000-0000-0000000000e2', 'Write user stories', 'pending') $$,
  'granted BA can assign to anyone');
SELECT is((SELECT count(*)::int FROM tasks WHERE user_id = '00000000-0000-0000-0000-0000000000e2') >= 2, true,
  'granted BA can see everyone''s tasks');

SELECT * FROM finish();
ROLLBACK;
