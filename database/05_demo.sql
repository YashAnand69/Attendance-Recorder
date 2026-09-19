-- Attendly / Attendance Recorder
-- Project demonstration script.
-- Run after @00_setup.sql.
-- Designed for SQL*Plus / SQLcl / SQL Developer "Run Script".

SET SERVEROUTPUT ON;
SET LINESIZE 180;
SET PAGESIZE 100;

PROMPT ============================================================
PROMPT ATTENDLY DATABASE MINI-PROJECT DEMONSTRATION
PROMPT ============================================================

PROMPT
PROMPT [STEP 1] Show the normalized roster and classroom relationship.
SELECT
  s.roll_number,
  s.student_name,
  c.classroom_name,
  c.teacher_name
FROM students s
JOIN classrooms c
  ON c.classroom_id = s.classroom_id
ORDER BY s.roll_number;

PROMPT
PROMPT [STEP 2] Demonstrate CREATE by adding a new class session.
INSERT INTO class_sessions (
  classroom_id,
  session_date,
  start_time,
  topic,
  session_status
) VALUES (
  'class-101',
  DATE '2026-09-19',
  TO_TIMESTAMP('2026-09-19 08:30:00', 'YYYY-MM-DD HH24:MI:SS'),
  'PL/SQL Procedures and Triggers',
  'OPEN'
);

COMMIT;

VARIABLE demo_session_id NUMBER;

BEGIN
  SELECT session_id
    INTO :demo_session_id
    FROM class_sessions
   WHERE classroom_id = 'class-101'
     AND session_date = DATE '2026-09-19';

  DBMS_OUTPUT.PUT_LINE('Created demo session ID = ' || :demo_session_id);
END;
/

PROMPT
PROMPT [STEP 3] Demonstrate PL/SQL attendance marking with geofence validation.
VARIABLE demo_attendance_id NUMBER;

BEGIN
  attendance_pkg.mark_attendance(
    p_student_id          => 'stu-001',
    p_session_id          => :demo_session_id,
    p_status              => 'PRESENT',
    p_attendance_id       => :demo_attendance_id,
    p_confidence          => 98.75,
    p_latitude            => 37.7749000,
    p_longitude           => -122.4194000,
    p_verification_method => 'FACE_RECOGNITION',
    p_synced_offline      => 'N',
    p_notes               => 'Demo: face match + classroom geofence passed'
  );

  DBMS_OUTPUT.PUT_LINE('Attendance ID = ' || :demo_attendance_id);
END;
/

COMMIT;

PROMPT
PROMPT [STEP 4] Demonstrate READ with a join.
SELECT
  a.attendance_id,
  s.roll_number,
  s.student_name,
  cs.session_date,
  a.status,
  a.confidence,
  a.verification_method
FROM attendance a
JOIN students s
  ON s.student_id = a.student_id
JOIN class_sessions cs
  ON cs.session_id = a.session_id
WHERE a.attendance_id = :demo_attendance_id;

PROMPT
PROMPT [STEP 5] Demonstrate UPDATE through the PL/SQL package.
BEGIN
  attendance_pkg.mark_attendance(
    p_student_id          => 'stu-001',
    p_session_id          => :demo_session_id,
    p_status              => 'LATE',
    p_attendance_id       => :demo_attendance_id,
    p_confidence          => 98.75,
    p_latitude            => 37.7749000,
    p_longitude           => -122.4194000,
    p_verification_method => 'FACE_RECOGNITION',
    p_synced_offline      => 'N',
    p_notes               => 'Demo update: status corrected to LATE'
  );
END;
/

COMMIT;

SELECT
  attendance_id,
  status,
  notes
FROM attendance
WHERE attendance_id = :demo_attendance_id;

PROMPT
PROMPT [STEP 6] Prove that the audit trigger captured INSERT and UPDATE.
SELECT
  audit_id,
  attendance_id,
  action_type,
  old_status,
  new_status,
  changed_by,
  TO_CHAR(changed_at, 'YYYY-MM-DD HH24:MI:SS') AS changed_at
FROM attendance_audit
WHERE attendance_id = :demo_attendance_id
ORDER BY audit_id;

PROMPT
PROMPT [STEP 7] Automatically mark all unrecorded students ABSENT.
BEGIN
  attendance_pkg.mark_absentees(:demo_session_id);
END;
/

COMMIT;

SELECT
  s.roll_number,
  s.student_name,
  a.status
FROM attendance a
JOIN students s
  ON s.student_id = a.student_id
WHERE a.session_id = :demo_session_id
ORDER BY s.roll_number;

PROMPT
PROMPT [STEP 8] Generate parent-alert queue entries for absent students.
BEGIN
  attendance_pkg.generate_absence_alerts(:demo_session_id);
END;
/

COMMIT;

SELECT
  pa.alert_id,
  s.roll_number,
  s.student_name,
  pa.recipient_email,
  pa.alert_status
FROM parent_alerts pa
JOIN students s
  ON s.student_id = pa.student_id
WHERE pa.alert_date = DATE '2026-09-19'
ORDER BY s.roll_number;

PROMPT
PROMPT [STEP 9] Demonstrate analytical function.
SELECT
  s.roll_number,
  s.student_name,
  attendance_pkg.attendance_percentage(
    s.student_id,
    DATE '2026-09-15',
    DATE '2026-09-19'
  ) AS attendance_percentage
FROM students s
ORDER BY s.roll_number;

PROMPT
PROMPT [STEP 10] Demonstrate geofence rejection using an anonymous block.
BEGIN
  DECLARE
    v_id NUMBER;
  BEGIN
    attendance_pkg.mark_attendance(
      p_student_id          => 'stu-002',
      p_session_id          => :demo_session_id,
      p_status              => 'PRESENT',
      p_attendance_id       => v_id,
      p_confidence          => 96.00,
      p_latitude            => 37.7900000,
      p_longitude           => -122.4194000,
      p_verification_method => 'FACE_RECOGNITION'
    );
  EXCEPTION
    WHEN OTHERS THEN
      DBMS_OUTPUT.PUT_LINE('Expected validation error: ' || SQLERRM);
  END;
END;
/

PROMPT
PROMPT [STEP 11] Demonstrate DELETE and its audit entry.
DELETE FROM attendance
WHERE attendance_id = :demo_attendance_id;

COMMIT;

SELECT
  audit_id,
  attendance_id,
  action_type,
  old_status,
  new_status
FROM attendance_audit
WHERE attendance_id = :demo_attendance_id
ORDER BY audit_id;

PROMPT
PROMPT [STEP 12] Daily summary view.
SELECT *
FROM v_daily_class_summary
WHERE session_date = DATE '2026-09-19';

PROMPT
PROMPT ============================================================
PROMPT DEMONSTRATION COMPLETE
PROMPT Key technologies shown:
PROMPT - DDL and relational constraints
PROMPT - INSERT / SELECT / UPDATE / DELETE
PROMPT - JOINs, GROUP BY, views and aggregate queries
PROMPT - PL/SQL package, procedures and functions
PROMPT - MERGE/upsert
PROMPT - row-level audit trigger
PROMPT - exception handling and validation
PROMPT - parent-alert generation
PROMPT - attendance analytics
PROMPT ============================================================
