-- Demo team for trying out roles + Team Analytics locally.
-- Creates 1 manager + 3 employees as real (login-able) accounts and fills in
-- recent work logs relative to CURRENT_DATE so charts/streaks have data.
--
-- Login for all demo accounts:  password = stridelog123
--   manager@speedit.test   (manager)
--   arjun@speedit.test     (employee)
--   sara@speedit.test      (employee)
--   liam@speedit.test      (employee)
--
-- Idempotent: safe to run more than once.

DO $$
DECLARE
  users jsonb := '[
    {"email":"manager@speedit.test","name":"Maya Manager","role":"manager"},
    {"email":"arjun@speedit.test","name":"Arjun Rao","role":"employee"},
    {"email":"sara@speedit.test","name":"Sara Khan","role":"employee"},
    {"email":"liam@speedit.test","name":"Liam Patel","role":"employee"}
  ]';
  u jsonb;
  uid uuid;
  d date;
  lg uuid;
  dev uuid; test uuid; meet uuid; design uuid;
  cats uuid[];
  ntasks int;
  i int;
  st text;
BEGIN
  SELECT id INTO dev    FROM categories WHERE name = 'Development' LIMIT 1;
  SELECT id INTO test   FROM categories WHERE name = 'Testing'     LIMIT 1;
  SELECT id INTO meet   FROM categories WHERE name = 'Meeting'     LIMIT 1;
  SELECT id INTO design FROM categories WHERE name = 'Design'      LIMIT 1;
  cats := ARRAY[dev, test, meet, design];

  FOR u IN SELECT * FROM jsonb_array_elements(users) LOOP
    -- Create the auth user if it doesn't exist; the handle_new_user trigger
    -- creates the matching profile (name + role from metadata).
    SELECT id INTO uid FROM auth.users WHERE email = u->>'email';
    IF uid IS NULL THEN
      uid := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        -- GoTrue scans these as text and errors on NULL, so seed them as ''.
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
        u->>'email', crypt('stridelog123', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('name', u->>'name', 'role', u->>'role'),
        now(), now(),
        '', '', '', '', '', '', '', ''
      );
    END IF;

    -- Trigger creates every signup as an unapproved employee; demo accounts are
    -- pre-approved with their intended role.
    UPDATE profiles SET role = u->>'role', is_approved = true WHERE id = uid;

    -- Recent work logs over the last two weeks (weekdays only).
    FOR d IN SELECT generate_series(CURRENT_DATE - 13, CURRENT_DATE, interval '1 day')::date LOOP
      CONTINUE WHEN extract(dow from d) IN (0, 6);                       -- skip weekends
      CONTINUE WHEN EXISTS (SELECT 1 FROM work_logs WHERE user_id = uid AND date = d);

      INSERT INTO work_logs (user_id, date, what_i_did, submitted_at)
        VALUES (uid, d, 'Daily work log for ' || to_char(d, 'DD Mon'), now())
        RETURNING id INTO lg;

      ntasks := 2 + (extract(day from d)::int % 3);                      -- 2..4 tasks
      FOR i IN 1..ntasks LOOP
        st := CASE
                WHEN i = ntasks AND (extract(day from d)::int % 4) = 0 THEN 'in_progress'
                WHEN i = ntasks AND (extract(day from d)::int % 5) = 0 THEN 'pending'
                ELSE 'done'
              END;
        INSERT INTO tasks (log_id, user_id, title, status, category_id)
          VALUES (lg, uid, 'Task ' || i || ' — ' || to_char(d, 'DD Mon'), st, cats[1 + (i % 4)]);
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Demo team seeded (manager@speedit.test + 3 employees, password stridelog123)';
END;
$$;
