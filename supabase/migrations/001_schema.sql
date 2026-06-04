-- profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name             text NOT NULL,
  role             text NOT NULL CHECK (role IN ('employee', 'admin')),
  avatar_initials  text,
  is_active        bool DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

-- Auto-create profile row when auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, role, avatar_initials)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 2))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- categories
CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#7c3aed',
  is_active   bool DEFAULT true,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

-- work_logs (one per user per calendar day)
CREATE TABLE work_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date          date NOT NULL,
  what_i_did    text,
  blockers      text,
  tomorrow_plan text,
  submitted_at  timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_logs_updated_at
  BEFORE UPDATE ON work_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- tasks (many per work_log)
CREATE TABLE tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id       uuid NOT NULL REFERENCES work_logs(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        text NOT NULL,
  status       text NOT NULL CHECK (status IN ('done', 'in_progress', 'pending')),
  category_id  uuid REFERENCES categories(id),
  custom_tag   text,
  hours        numeric(4,1),
  created_at   timestamptz DEFAULT now()
);

-- Seed default categories
INSERT INTO categories (name, color) VALUES
  ('Development',    '#7c3aed'),
  ('Design',         '#ec4899'),
  ('Meeting',        '#f59e0b'),
  ('Testing',        '#10b981'),
  ('Documentation',  '#3b82f6'),
  ('Review',         '#8b5cf6');
