-- Invited users are pre-approved by the invite-user Edge Function (service
-- role, no auth.uid()). They already receive the invite email, so don't also
-- send "your account was approved". Approvals by HR/admin in the app still notify.
CREATE OR REPLACE FUNCTION notify_profile_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_approved AND NOT OLD.is_approved AND auth.uid() IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (NEW.id, 'account_approved', 'Your account was approved',
            'Welcome aboard! You can now log your daily work.', '/today');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
