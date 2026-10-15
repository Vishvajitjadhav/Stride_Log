-- Admin / HR can add a person with a temporary password (no email needed).
-- The person must choose their own password the first time they sign in.

ALTER TABLE profiles
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
