DO $$
DECLARE
  uid uuid := '0166e404-478f-4e92-ba1f-20172a0cd9a9';
  dev_cat uuid;
  meet_cat uuid;
  test_cat uuid;
  log_id uuid;
BEGIN
  SELECT id INTO dev_cat  FROM categories WHERE name = 'Development' LIMIT 1;
  SELECT id INTO meet_cat FROM categories WHERE name = 'Meeting'     LIMIT 1;
  SELECT id INTO test_cat FROM categories WHERE name = 'Testing'     LIMIT 1;

  -- 15 May 2026
  INSERT INTO work_logs (user_id,date,what_i_did,submitted_at)
    VALUES (uid,'2026-05-15','Joined Speed IT Innovation. Completed onboarding.',now()) RETURNING id INTO log_id;
  INSERT INTO tasks (log_id,user_id,title,status) VALUES
    (log_id,uid,'Joined Speed IT Innovation','done'),
    (log_id,uid,'Onboarding','done');

  -- 16 May
  INSERT INTO work_logs (user_id,date,what_i_did,submitted_at)
    VALUES (uid,'2026-05-16','First day at office. GuruCool session with Prasad. Client meeting.',now()) RETURNING id INTO log_id;
  INSERT INTO tasks (log_id,user_id,title,status,category_id) VALUES
    (log_id,uid,'First day at office','done',NULL),
    (log_id,uid,'GuruCool project understanding session with Prasad','done',dev_cat),
    (log_id,uid,'Attended client meeting','done',meet_cat);

  -- 19 May
  INSERT INTO work_logs (user_id,date,what_i_did,submitted_at)
    VALUES (uid,'2026-05-19','Continued understanding GuruCool. Project testing.',now()) RETURNING id INTO log_id;
  INSERT INTO tasks (log_id,user_id,title,status,category_id) VALUES
    (log_id,uid,'Continued understanding the GuruCool project','done',dev_cat),
    (log_id,uid,'GuruCool project testing','done',test_cat);

  -- 20 May
  INSERT INTO work_logs (user_id,date,what_i_did,submitted_at)
    VALUES (uid,'2026-05-20','GuruCool testing. Explored codebase and tech stack. Learned Git workflow.',now()) RETURNING id INTO log_id;
  INSERT INTO tasks (log_id,user_id,title,status,category_id) VALUES
    (log_id,uid,'GuruCool project testing','done',test_cat),
    (log_id,uid,'Explored codebase, tech stack and user journey','done',dev_cat),
    (log_id,uid,'Learned production-level Git & GitHub branching strategies','done',dev_cat);

  -- 21 May
  INSERT INTO work_logs (user_id,date,what_i_did,submitted_at)
    VALUES (uid,'2026-05-21','Daily stand-up. GuruCool competency test. PD testing.',now()) RETURNING id INTO log_id;
  INSERT INTO tasks (log_id,user_id,title,status,category_id) VALUES
    (log_id,uid,'Daily stand-up','done',meet_cat),
    (log_id,uid,'GuruCool competency test','done',test_cat),
    (log_id,uid,'GuruCool PD testing','done',test_cat);

  -- 22 May
  INSERT INTO work_logs (user_id,date,what_i_did,submitted_at)
    VALUES (uid,'2026-05-22','GuruCool AI testing. Meeting with May. Requirements discussion.',now()) RETURNING id INTO log_id;
  INSERT INTO tasks (log_id,user_id,title,status,category_id) VALUES
    (log_id,uid,'GuruCool AI testing','done',test_cat),
    (log_id,uid,'Meeting with May','done',meet_cat),
    (log_id,uid,'Discussed requirements for next update','done',meet_cat);

  -- 25 May
  INSERT INTO work_logs (user_id,date,what_i_did,submitted_at)
    VALUES (uid,'2026-05-25','Set up Claude in VS Code. Learned prompting. Tested GuruCool update.',now()) RETURNING id INTO log_id;
  INSERT INTO tasks (log_id,user_id,title,status,category_id) VALUES
    (log_id,uid,'Set up Claude in VS Code','done',dev_cat),
    (log_id,uid,'Learned prompting techniques','done',dev_cat),
    (log_id,uid,'Tested updated version of GuruCool','done',test_cat);

  -- 26 May
  INSERT INTO work_logs (user_id,date,what_i_did,submitted_at)
    VALUES (uid,'2026-05-26','GuruCool personalization testing. Meeting with May. Team meeting with Ankur.',now()) RETURNING id INTO log_id;
  INSERT INTO tasks (log_id,user_id,title,status,category_id) VALUES
    (log_id,uid,'GuruCool personalization testing','done',test_cat),
    (log_id,uid,'Meeting with May','done',meet_cat),
    (log_id,uid,'Understood GuruCool improvements and changes','done',dev_cat),
    (log_id,uid,'GuruCool team meeting with Ankur','done',meet_cat);

  -- 27 May
  INSERT INTO work_logs (user_id,date,what_i_did,submitted_at)
    VALUES (uid,'2026-05-27','Updated GuruCool logo. Understood mobile app requirements. Built note-taking app.',now()) RETURNING id INTO log_id;
  INSERT INTO tasks (log_id,user_id,title,status,category_id) VALUES
    (log_id,uid,'Updated GuruCool logo and logo size','done',dev_cat),
    (log_id,uid,'Understood new requirements for mobile app project','done',dev_cat),
    (log_id,uid,'Discussed PD assign logic and competency UI changes','done',dev_cat),
    (log_id,uid,'Built a note-taking mobile app to learn mobile dev environment','done',dev_cat);

  -- 28 May
  INSERT INTO work_logs (user_id,date,what_i_did,submitted_at)
    VALUES (uid,'2026-05-28','Stand-up and team meeting. GuruCool feature score logic. UI changes.',now()) RETURNING id INTO log_id;
  INSERT INTO tasks (log_id,user_id,title,status,category_id) VALUES
    (log_id,uid,'Daily stand-up and team meeting','done',meet_cat),
    (log_id,uid,'Worked on GuruCool feature score logic','done',dev_cat),
    (log_id,uid,'Made UI changes in GuruCool application','done',dev_cat);

  -- 29 May
  INSERT INTO work_logs (user_id,date,what_i_did,submitted_at)
    VALUES (uid,'2026-05-29','GuruCool testing. Document review for mobile app.',now()) RETURNING id INTO log_id;
  INSERT INTO tasks (log_id,user_id,title,status,category_id) VALUES
    (log_id,uid,'GuruCool testing','done',test_cat),
    (log_id,uid,'Document review for the mobile app','done',dev_cat);

  -- 01 Jun
  INSERT INTO work_logs (user_id,date,what_i_did,submitted_at)
    VALUES (uid,'2026-06-01','New requirements discussion. GuruCool testing and UI changes. Built game app.',now()) RETURNING id INTO log_id;
  INSERT INTO tasks (log_id,user_id,title,status,category_id) VALUES
    (log_id,uid,'Discussed new requirements','done',meet_cat),
    (log_id,uid,'GuruCool testing','done',test_cat),
    (log_id,uid,'GuruCool UI changes','done',dev_cat),
    (log_id,uid,'Built a game mobile app','done',dev_cat),
    (log_id,uid,'Meeting on GuruCool requirements','done',meet_cat);

  -- 02 Jun
  INSERT INTO work_logs (user_id,date,what_i_did,submitted_at)
    VALUES (uid,'2026-06-02','Worked on 2 GuruCool features. Client meeting. Requirements estimation.',now()) RETURNING id INTO log_id;
  INSERT INTO tasks (log_id,user_id,title,status,category_id) VALUES
    (log_id,uid,'Worked on 2 features of the GuruCool app','done',dev_cat),
    (log_id,uid,'Client meeting','done',meet_cat),
    (log_id,uid,'New requirements discussion and estimation','done',meet_cat),
    (log_id,uid,'Team meeting','done',meet_cat);

  -- 03 Jun
  INSERT INTO work_logs (user_id,date,what_i_did,submitted_at)
    VALUES (uid,'2026-06-03','Team meeting on GuruCool features. Fixed chatbot issue. Advanced testing.',now()) RETURNING id INTO log_id;
  INSERT INTO tasks (log_id,user_id,title,status,category_id) VALUES
    (log_id,uid,'Team meeting on GuruCool features','done',meet_cat),
    (log_id,uid,'Fixed a GuruCool chatbot issue','done',dev_cat),
    (log_id,uid,'Advanced-level GuruCool testing','done',test_cat);

  RAISE NOTICE 'All 13 days imported successfully';
END;
$$;
