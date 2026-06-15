-- Add the 'manager' role: a company manager who can view all team data and
-- analytics, and manage task categories, but cannot manage user accounts.

-- 1. Widen the role constraint to allow 'manager'
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('employee', 'manager', 'admin'));

-- 2. is_staff(): true for admins AND managers (used for read-all + category mgmt)
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Additive RLS policies for staff (admin-only policies remain in place).
--    Postgres combines policies with OR, so these only widen read access;
--    write access to logs/tasks stays restricted to the owning employee.

-- profiles: staff can read every profile (for team views + analytics)
CREATE POLICY "staff read profiles" ON profiles FOR SELECT USING (is_staff());

-- work_logs: staff can read every log (read-only; no update policy granted)
CREATE POLICY "staff read logs" ON work_logs FOR SELECT USING (is_staff());

-- tasks: staff can read every task
CREATE POLICY "staff read tasks" ON tasks FOR SELECT USING (is_staff());

-- categories: managers (and admins) can add / edit / toggle categories
CREATE POLICY "staff manage categories" ON categories FOR ALL
  USING (is_staff()) WITH CHECK (is_staff());

-- Admins can write logs/tasks for ANY user — needed to import a member's
-- historical sheet on their behalf. Employees & managers still write only their
-- own (via the existing "own logs" / "own tasks" policies).
CREATE POLICY "admin manage logs"  ON work_logs FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admin manage tasks" ON tasks     FOR ALL USING (is_admin()) WITH CHECK (is_admin());
