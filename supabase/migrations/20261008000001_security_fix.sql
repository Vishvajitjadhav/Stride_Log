-- Phase 0: security hardening.
--
-- 1. The "own profile update" policy let any user update ANY column of their own
--    profile row, including role and is_approved — so a fresh sign-up could make
--    themselves admin from the browser console. RLS can't restrict columns, so a
--    trigger now blocks privileged columns for non-privileged callers.
-- 2. SECURITY DEFINER functions get a pinned search_path (Supabase linter 0011).

ALTER FUNCTION is_admin()         SET search_path = public;
ALTER FUNCTION is_staff()         SET search_path = public;
ALTER FUNCTION handle_new_user()  SET search_path = public;
ALTER FUNCTION update_updated_at() SET search_path = public;

CREATE OR REPLACE FUNCTION guard_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Service role / SQL editor / migrations (no end-user JWT) are trusted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT is_admin() AND (
       NEW.role        IS DISTINCT FROM OLD.role
    OR NEW.is_approved IS DISTINCT FROM OLD.is_approved
    OR NEW.is_active   IS DISTINCT FROM OLD.is_active
    OR NEW.email       IS DISTINCT FROM OLD.email
    OR NEW.id          IS DISTINCT FROM OLD.id
  ) THEN
    RAISE EXCEPTION 'Not allowed to change role, approval, status or email'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER profiles_guard_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_profile_update();
