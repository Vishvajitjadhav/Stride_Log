ALTER TABLE profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks      ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- profiles
CREATE POLICY "own profile read"   ON profiles FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY "own profile update" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "admin insert"       ON profiles FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "admin update all"   ON profiles FOR UPDATE USING (is_admin());

-- categories
CREATE POLICY "auth read active categories" ON categories FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY "admin manage categories"     ON categories FOR ALL   USING (is_admin());

-- work_logs
CREATE POLICY "own logs"        ON work_logs FOR ALL    USING (user_id = auth.uid());
CREATE POLICY "admin read logs" ON work_logs FOR SELECT USING (is_admin());

-- tasks
CREATE POLICY "own tasks"        ON tasks FOR ALL    USING (user_id = auth.uid());
CREATE POLICY "admin read tasks" ON tasks FOR SELECT USING (is_admin());
