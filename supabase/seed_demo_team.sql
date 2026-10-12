-- Demo company for trying every role locally.
-- Creates login-able accounts, three projects, and ~3 weeks of work relative to
-- CURRENT_DATE so dashboards, calendars and reports have data.
--
-- Login for all demo accounts:  password = stridelog123
--   admin@speedit.test     (admin)
--   manager@speedit.test   (manager)
--   hr@speedit.test        (HR)
--   ba@speedit.test        (business analyst, granted "can assign tasks")
--   arjun@speedit.test     (employee)
--   sara@speedit.test      (employee)
--   liam@speedit.test      (employee)
--
-- Idempotent: safe to run more than once.


DO $$
DECLARE
  users jsonb := '[
    {"email":"admin@speedit.test","name":"Ada Admin","role":"admin"},
    {"email":"manager@speedit.test","name":"Maya Manager","role":"manager"},
    {"email":"hr@speedit.test","name":"Hana HR","role":"hr"},
    {"email":"ba@speedit.test","name":"Bilal Analyst","role":"ba","assign":true},
    {"email":"arjun@speedit.test","name":"Arjun Rao","role":"employee"},
    {"email":"sara@speedit.test","name":"Sara Khan","role":"employee"},
    {"email":"liam@speedit.test","name":"Liam Patel","role":"employee"}
  ]';
  u jsonb;
  uid uuid;
  mgr uuid;
  d date;
  cats uuid[];
  ntasks int;
  i int;
  st text;
  seed int;
BEGIN
  SELECT array_agg(id ORDER BY name) INTO cats FROM categories
  WHERE name IN ('Development', 'Testing', 'Team Meeting', 'Scrum Call', 'Code Review', 'Design', 'Interview', 'Brainstorming');

  INSERT INTO holidays (date, name) VALUES (CURRENT_DATE - 9, 'Demo Holiday') ON CONFLICT DO NOTHING;

  FOR u IN SELECT * FROM jsonb_array_elements(users) LOOP
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
        jsonb_build_object('name', u->>'name'),
        now() - interval '30 days', now(),
        '', '', '', '', '', '', '', ''
      );
    END IF;

    -- Signups start as unapproved employees; demo accounts get their role.
    UPDATE profiles SET
      role = u->>'role',
      is_approved = true,
      is_active = true,
      created_at = least(created_at, now() - interval '30 days'),
      can_assign_tasks = coalesce((u->>'assign')::boolean, false)
    WHERE id = uid;

    IF u->>'role' = 'manager' THEN mgr := uid; END IF;
    seed := length(u->>'email');

    -- ~3 weeks of logs. Weekends skipped except one Saturday of extra work.
    FOR d IN SELECT generate_series(CURRENT_DATE - 20, CURRENT_DATE, interval '1 day')::date LOOP
      CONTINUE WHEN extract(isodow from d) = 7;
      CONTINUE WHEN extract(isodow from d) = 6 AND NOT (u->>'email' = 'arjun@speedit.test' AND d >= CURRENT_DATE - 7);
      CONTINUE WHEN EXISTS (SELECT 1 FROM holidays h WHERE h.date = d);
      CONTINUE WHEN EXISTS (SELECT 1 FROM work_logs WHERE user_id = uid AND date = d);
      CONTINUE WHEN (extract(day from d)::int + seed) % 7 = 0;          -- the odd missed day

      INSERT INTO work_logs (user_id, date, what_i_did, blockers, submitted_at)
      VALUES (uid, d, 'Progress on sprint work for ' || to_char(d, 'DD Mon'),
              CASE WHEN (extract(day from d)::int + seed) % 9 = 0 THEN 'Waiting on review from another team' END,
              CASE WHEN d < CURRENT_DATE THEN now() END);

      ntasks := 2 + ((extract(day from d)::int + seed) % 3);
      FOR i IN 1..ntasks LOOP
        st := CASE
                WHEN d = CURRENT_DATE AND i > 1 THEN 'pending'
                WHEN i = ntasks AND (extract(day from d)::int + seed) % 6 = 0 THEN 'blocked'
                WHEN i = ntasks AND (extract(day from d)::int + seed) % 4 = 0 THEN 'in_progress'
                ELSE 'done'
              END;
        INSERT INTO tasks (user_id, date, title, status, category_id, completed_on)
        VALUES (uid, d, (ARRAY['Implement feature', 'Fix bug', 'Sprint planning', 'Daily scrum', 'Review PR', 'Write tests', 'Candidate interview', 'Design review'])[1 + ((i + seed) % 8)] || ' #' || (100 + i + extract(doy from d)::int),
                st, cats[1 + ((i + seed) % array_length(cats, 1))],
                CASE WHEN st = 'done' THEN d END);
      END LOOP;
    END LOOP;
  END LOOP;

  -- A few tasks the manager assigned (one overdue, one done on time).
  IF mgr IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tasks WHERE assigned_by = mgr) THEN
    INSERT INTO tasks (user_id, date, title, status, priority, due_date, assigned_by, completed_on, category_id)
    SELECT p.id, CURRENT_DATE - 3, 'Prepare release notes', 'pending', 'high', CURRENT_DATE - 1, mgr, NULL, cats[1]
    FROM profiles p JOIN auth.users au ON au.id = p.id WHERE au.email = 'arjun@speedit.test'
    UNION ALL
    SELECT p.id, CURRENT_DATE - 5, 'Update onboarding doc', 'done', 'normal', CURRENT_DATE - 4, mgr, CURRENT_DATE - 4, cats[1]
    FROM profiles p JOIN auth.users au ON au.id = p.id WHERE au.email = 'sara@speedit.test'
    UNION ALL
    SELECT p.id, CURRENT_DATE, 'Client demo dry-run', 'pending', 'normal', CURRENT_DATE + 2, mgr, NULL, cats[1]
    FROM profiles p JOIN auth.users au ON au.id = p.id WHERE au.email = 'liam@speedit.test';
  END IF;

  -- Projects: people can be in several; managers can run several.
  INSERT INTO projects (name, description, color) VALUES
    ('Mobile App',    'Customer mobile app for iOS and Android', '#2f4e7e'),
    ('Web Platform',  'Main web product and admin console',     '#2c7a7b'),
    ('Client Portal', 'Portal for enterprise clients',          '#b8902f')
  ON CONFLICT (name) DO NOTHING;

  INSERT INTO project_members (project_id, user_id, role)
  SELECT pr.id, p.id, m.role
  FROM (VALUES
    ('Mobile App',    'manager@speedit.test', 'manager'),
    ('Mobile App',    'arjun@speedit.test',   'member'),
    ('Mobile App',    'sara@speedit.test',    'member'),
    ('Mobile App',    'ba@speedit.test',      'member'),
    ('Web Platform',  'manager@speedit.test', 'manager'),
    ('Web Platform',  'arjun@speedit.test',   'member'),
    ('Web Platform',  'liam@speedit.test',    'member'),
    ('Client Portal', 'admin@speedit.test',   'manager'),
    ('Client Portal', 'liam@speedit.test',    'member'),
    ('Client Portal', 'sara@speedit.test',    'member'),
    ('Client Portal', 'ba@speedit.test',      'member')
  ) AS m(project, email, role)
  JOIN projects pr ON pr.name = m.project
  JOIN auth.users au ON au.email = m.email
  JOIN profiles p ON p.id = au.id
  ON CONFLICT DO NOTHING;

  -- Tag each demo task with one of its owner's projects (spread evenly).
  UPDATE tasks t SET project_id = (
    SELECT pm.project_id FROM project_members pm
    JOIN projects pr ON pr.id = pm.project_id
    WHERE pm.user_id = t.user_id AND pr.name IN ('Mobile App', 'Web Platform', 'Client Portal')
    ORDER BY pm.project_id
    OFFSET (abs(hashtext(t.id::text)) % greatest(1, (SELECT count(*) FROM project_members x JOIN projects y ON y.id = x.project_id
             WHERE x.user_id = t.user_id AND y.name IN ('Mobile App', 'Web Platform', 'Client Portal'))))
    LIMIT 1)
  WHERE EXISTS (SELECT 1 FROM project_members pm JOIN projects pr ON pr.id = pm.project_id
                WHERE pm.user_id = t.user_id AND pr.name IN ('Mobile App', 'Web Platform', 'Client Portal'));

  RAISE NOTICE 'Demo company seeded. Password stridelog123';
END;
$$;
