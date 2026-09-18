-- Attendly / Attendance Recorder
-- Sample data matching the repository's CS-301 demo classroom.

SET DEFINE OFF;

INSERT INTO classrooms (
  classroom_id, classroom_name, latitude, longitude, radius_meters, teacher_name
) VALUES (
  'class-101', 'CS-301 Computer Science Lab', 37.7749000, -122.4194000, 50, 'Prof. Sarah Jenkins'
);

INSERT ALL
  INTO students VALUES ('stu-001', 'CS2026-001', 'Alex Rivera',       'class-101', 'parent.alex@example.com',   '+1 (555) 234-5678', 'https://example.com/faces/stu-001.jpg', 'ACTIVE', TO_TIMESTAMP('2026-08-01 08:00:00','YYYY-MM-DD HH24:MI:SS'))
  INTO students VALUES ('stu-002', 'CS2026-002', 'Sophia Chen',       'class-101', 'parent.sophia@example.com', '+1 (555) 876-5432', 'https://example.com/faces/stu-002.jpg', 'ACTIVE', TO_TIMESTAMP('2026-08-01 08:00:00','YYYY-MM-DD HH24:MI:SS'))
  INTO students VALUES ('stu-003', 'CS2026-003', 'Marcus Vance',      'class-101', 'parent.marcus@example.com', '+1 (555) 345-6789', 'https://example.com/faces/stu-003.jpg', 'ACTIVE', TO_TIMESTAMP('2026-08-01 08:00:00','YYYY-MM-DD HH24:MI:SS'))
  INTO students VALUES ('stu-004', 'CS2026-004', 'Elena Rostova',     'class-101', 'parent.elena@example.com',  '+1 (555) 901-2345', 'https://example.com/faces/stu-004.jpg', 'ACTIVE', TO_TIMESTAMP('2026-08-01 08:00:00','YYYY-MM-DD HH24:MI:SS'))
  INTO students VALUES ('stu-005', 'CS2026-005', 'David Kim',         'class-101', 'parent.david@example.com',  '+1 (555) 678-9012', 'https://example.com/faces/stu-005.jpg', 'ACTIVE', TO_TIMESTAMP('2026-08-01 08:00:00','YYYY-MM-DD HH24:MI:SS'))
  INTO students VALUES ('stu-006', 'CS2026-006', 'Amina Al-Mansoor', 'class-101', 'parent.amina@example.com',  '+1 (555) 432-1098', 'https://example.com/faces/stu-006.jpg', 'ACTIVE', TO_TIMESTAMP('2026-08-01 08:00:00','YYYY-MM-DD HH24:MI:SS'))
  INTO students VALUES ('stu-007', 'CS2026-007', 'Liam O''Connor',    'class-101', 'parent.liam@example.com',   '+1 (555) 567-8901', 'https://example.com/faces/stu-007.jpg', 'ACTIVE', TO_TIMESTAMP('2026-08-01 08:00:00','YYYY-MM-DD HH24:MI:SS'))
  INTO students VALUES ('stu-008', 'CS2026-008', 'Zoe Washington',   'class-101', 'parent.zoe@example.com',    '+1 (555) 654-3210', 'https://example.com/faces/stu-008.jpg', 'ACTIVE', TO_TIMESTAMP('2026-08-01 08:00:00','YYYY-MM-DD HH24:MI:SS'))
SELECT 1 FROM dual;

INSERT ALL
  INTO class_sessions (session_id, classroom_id, session_date, start_time, end_time, topic, session_status)
    VALUES (1001, 'class-101', DATE '2026-09-15', TO_TIMESTAMP('2026-09-15 08:30:00','YYYY-MM-DD HH24:MI:SS'), TO_TIMESTAMP('2026-09-15 10:00:00','YYYY-MM-DD HH24:MI:SS'), 'Relational Database Basics', 'COMPLETED')
  INTO class_sessions (session_id, classroom_id, session_date, start_time, end_time, topic, session_status)
    VALUES (1002, 'class-101', DATE '2026-09-16', TO_TIMESTAMP('2026-09-16 08:30:00','YYYY-MM-DD HH24:MI:SS'), TO_TIMESTAMP('2026-09-16 10:00:00','YYYY-MM-DD HH24:MI:SS'), 'SQL DDL and Constraints', 'COMPLETED')
  INTO class_sessions (session_id, classroom_id, session_date, start_time, end_time, topic, session_status)
    VALUES (1003, 'class-101', DATE '2026-09-17', TO_TIMESTAMP('2026-09-17 08:30:00','YYYY-MM-DD HH24:MI:SS'), TO_TIMESTAMP('2026-09-17 10:00:00','YYYY-MM-DD HH24:MI:SS'), 'Joins and Subqueries', 'COMPLETED')
  INTO class_sessions (session_id, classroom_id, session_date, start_time, end_time, topic, session_status)
    VALUES (1004, 'class-101', DATE '2026-09-18', TO_TIMESTAMP('2026-09-18 08:30:00','YYYY-MM-DD HH24:MI:SS'), TO_TIMESTAMP('2026-09-18 10:00:00','YYYY-MM-DD HH24:MI:SS'), 'Transactions and PL/SQL', 'COMPLETED')
SELECT 1 FROM dual;

-- Session 1001
INSERT ALL
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline, notes)
    VALUES (1001,'stu-001',TO_TIMESTAMP('2026-09-15 08:36:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',98.40,37.7749,-122.4194,'FACE_RECOGNITION','N','Verified inside classroom geofence')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline, notes)
    VALUES (1001,'stu-002',TO_TIMESTAMP('2026-09-15 08:38:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',96.10,37.7749,-122.4194,'FACE_RECOGNITION','N','Verified inside classroom geofence')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline, notes)
    VALUES (1001,'stu-003',TO_TIMESTAMP('2026-09-15 08:51:00','YYYY-MM-DD HH24:MI:SS'),'LATE',94.70,37.7749,-122.4194,'FACE_RECOGNITION','N','Arrived after start time')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline, notes)
    VALUES (1001,'stu-004',TO_TIMESTAMP('2026-09-15 08:42:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',97.20,37.7749,-122.4194,'FACE_RECOGNITION','N',NULL)
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline, notes)
    VALUES (1001,'stu-005',TO_TIMESTAMP('2026-09-15 09:00:00','YYYY-MM-DD HH24:MI:SS'),'ABSENT',NULL,NULL,NULL,'MANUAL','N','Marked absent after attendance window')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline, notes)
    VALUES (1001,'stu-006',TO_TIMESTAMP('2026-09-15 08:40:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',99.10,37.7749,-122.4194,'FACE_RECOGNITION','N',NULL)
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline, notes)
    VALUES (1001,'stu-007',TO_TIMESTAMP('2026-09-15 08:45:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',95.60,37.7749,-122.4194,'FACE_RECOGNITION','N',NULL)
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline, notes)
    VALUES (1001,'stu-008',TO_TIMESTAMP('2026-09-15 08:47:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',96.90,37.7749,-122.4194,'FACE_RECOGNITION','N',NULL)
SELECT 1 FROM dual;

-- Session 1002
INSERT ALL
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1002,'stu-001',TO_TIMESTAMP('2026-09-16 08:35:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',97.90,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1002,'stu-002',TO_TIMESTAMP('2026-09-16 08:37:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',96.50,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1002,'stu-003',TO_TIMESTAMP('2026-09-16 08:39:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',95.20,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1002,'stu-004',TO_TIMESTAMP('2026-09-16 08:56:00','YYYY-MM-DD HH24:MI:SS'),'LATE',95.80,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1002,'stu-005',TO_TIMESTAMP('2026-09-16 08:41:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',97.10,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1002,'stu-006',TO_TIMESTAMP('2026-09-16 08:43:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',98.50,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline, notes) VALUES (1002,'stu-007',TO_TIMESTAMP('2026-09-16 09:00:00','YYYY-MM-DD HH24:MI:SS'),'ABSENT',NULL,NULL,NULL,'MANUAL','N','Absent')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1002,'stu-008',TO_TIMESTAMP('2026-09-16 08:44:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',97.00,37.7749,-122.4194,'FACE_RECOGNITION','N')
SELECT 1 FROM dual;

-- Session 1003
INSERT ALL
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1003,'stu-001',TO_TIMESTAMP('2026-09-17 08:34:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',98.10,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline, notes) VALUES (1003,'stu-002',TO_TIMESTAMP('2026-09-17 09:00:00','YYYY-MM-DD HH24:MI:SS'),'ABSENT',NULL,NULL,NULL,'MANUAL','N','Absent')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1003,'stu-003',TO_TIMESTAMP('2026-09-17 08:52:00','YYYY-MM-DD HH24:MI:SS'),'LATE',93.80,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1003,'stu-004',TO_TIMESTAMP('2026-09-17 08:39:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',97.70,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1003,'stu-005',TO_TIMESTAMP('2026-09-17 08:41:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',96.40,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1003,'stu-006',TO_TIMESTAMP('2026-09-17 08:43:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',99.00,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1003,'stu-007',TO_TIMESTAMP('2026-09-17 08:44:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',95.90,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1003,'stu-008',TO_TIMESTAMP('2026-09-17 08:46:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',96.80,37.7749,-122.4194,'FACE_RECOGNITION','N')
SELECT 1 FROM dual;

-- Session 1004
INSERT ALL
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1004,'stu-001',TO_TIMESTAMP('2026-09-18 08:42:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',98.40,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1004,'stu-002',TO_TIMESTAMP('2026-09-18 08:45:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',96.10,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1004,'stu-003',TO_TIMESTAMP('2026-09-18 09:12:00','YYYY-MM-DD HH24:MI:SS'),'LATE',94.70,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline, notes) VALUES (1004,'stu-004',TO_TIMESTAMP('2026-09-18 09:00:00','YYYY-MM-DD HH24:MI:SS'),'ABSENT',NULL,NULL,NULL,'MANUAL','N','No verified presence')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline, notes) VALUES (1004,'stu-005',TO_TIMESTAMP('2026-09-18 09:00:00','YYYY-MM-DD HH24:MI:SS'),'ABSENT',NULL,NULL,NULL,'MANUAL','N','No verified presence')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1004,'stu-006',TO_TIMESTAMP('2026-09-18 08:50:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',99.10,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1004,'stu-007',TO_TIMESTAMP('2026-09-18 08:48:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',96.30,37.7749,-122.4194,'FACE_RECOGNITION','N')
  INTO attendance (session_id, student_id, recorded_at, status, confidence, latitude, longitude, verification_method, synced_offline) VALUES (1004,'stu-008',TO_TIMESTAMP('2026-09-18 08:49:00','YYYY-MM-DD HH24:MI:SS'),'PRESENT',97.20,37.7749,-122.4194,'FACE_RECOGNITION','N')
SELECT 1 FROM dual;

COMMIT;

PROMPT Sample dataset inserted: 1 classroom, 8 students, 4 sessions, 32 attendance rows.
