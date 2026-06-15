-- New users self-register and start in a "pending" state until an admin
-- approves them (and assigns their role).

-- 1. Approval flag. Existing users are already trusted, so approve them all.
ALTER TABLE profiles ADD COLUMN is_approved boolean NOT NULL DEFAULT false;
UPDATE profiles SET is_approved = true;

-- 2. Harden new-user creation: a public signup must NOT be able to grant itself
--    a privileged role or auto-approve via client-supplied metadata. Every new
--    signup becomes an unapproved 'employee'; an admin promotes/approves later.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, role, avatar_initials, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'employee',
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 2)),
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
