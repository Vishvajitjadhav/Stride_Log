-- Store email on the profile so admins can identify people in the approval
-- queue and team views (auth.users isn't exposed through the API).

ALTER TABLE profiles ADD COLUMN email text;

UPDATE profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email, role, avatar_initials, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'employee',
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 2)),
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
