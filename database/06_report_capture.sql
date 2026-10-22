-- Attendly: capture REAL Oracle execution evidence for your report.
-- Run after @@00_setup.sql in a dedicated, disposable demo schema.
-- This script does not run the destructive schema installer itself.
SET ECHO ON
SET SERVEROUTPUT ON
SET LINESIZE 180
SET PAGESIZE 80
SPOOL attendly-oracle-evidence.log

PROMPT === A. Database objects and compilation status ===
SELECT object_name, object_type, status
FROM user_objects
WHERE object_name IN (
  'CLASSROOMS','STUDENTS','CLASS_SESSIONS','ATTENDANCE',
  'PARENT_ALERTS','ATTENDANCE_AUDIT','ATTENDANCE_PKG',
  'TRG_ATTENDANCE_AUDIT','V_DAILY_CLASS_SUMMARY',
  'V_STUDENT_ATTENDANCE_SUMMARY'
)
ORDER BY object_type, object_name;
SELECT name, type, line, position, text
FROM user_errors
ORDER BY name, sequence;

PROMPT === B. Table structure, keys and domain constraints ===
SELECT table_name, column_name, data_type, nullable
FROM user_tab_columns
WHERE table_name IN ('CLASSROOMS','STUDENTS','CLASS_SESSIONS',
  'ATTENDANCE','PARENT_ALERTS','ATTENDANCE_AUDIT')
ORDER BY table_name, column_id;
SELECT table_name, constraint_name, constraint_type,
       r_constraint_name, status
FROM user_constraints
WHERE table_name IN ('CLASSROOMS','STUDENTS','CLASS_SESSIONS',
  'ATTENDANCE','PARENT_ALERTS','ATTENDANCE_AUDIT')
ORDER BY table_name, constraint_type, constraint_name;
SELECT table_name, index_name, uniqueness
FROM user_indexes
WHERE table_name IN ('CLASSROOMS','STUDENTS','CLASS_SESSIONS',
  'ATTENDANCE','PARENT_ALERTS','ATTENDANCE_AUDIT')
ORDER BY table_name, index_name;

PROMPT === C. Real data and analytical query results ===
@@04_queries.sql

PROMPT === D. Rejected duplicate: expect ORA-00001 ===
SAVEPOINT before_duplicate;
BEGIN
  INSERT INTO attendance (session_id, student_id, status)
  VALUES (1001, 'stu-001', 'PRESENT');
  RAISE_APPLICATION_ERROR(-20999, 'FAIL: duplicate was accepted');
EXCEPTION
  WHEN DUP_VAL_ON_INDEX THEN
    DBMS_OUTPUT.PUT_LINE('PASS: duplicate blocked: ' || SQLERRM);
END;
/
ROLLBACK TO before_duplicate;

PROMPT === E. Transaction and trigger share one transaction ===
VARIABLE audit_before NUMBER
BEGIN
  SELECT COUNT(*) INTO :audit_before FROM attendance_audit;
END;
/
SAVEPOINT before_update;
UPDATE attendance SET status = 'LATE'
WHERE session_id = 1001 AND student_id = 'stu-001';
SELECT action_type, old_status, new_status
FROM attendance_audit
WHERE attendance_id = (
  SELECT attendance_id FROM attendance
  WHERE session_id = 1001 AND student_id = 'stu-001'
);
ROLLBACK TO before_update;
SELECT :audit_before AS before_count, COUNT(*) AS after_rollback_count
FROM attendance_audit;

PROMPT === F. Zero-session regression: no phantom absence ===
SAVEPOINT before_empty_room;
INSERT INTO classrooms (classroom_id, classroom_name, latitude,
  longitude, radius_meters)
VALUES ('report-empty', 'No sessions test', 0, 0, 50);
INSERT INTO students (student_id, roll_number, student_name, classroom_id)
VALUES ('report-empty-stu', 'REPORT-EMPTY', 'Test student', 'report-empty');
SELECT total_sessions, absent_or_missing_count
FROM v_student_attendance_summary
WHERE student_id = 'report-empty-stu';
-- Both counts should be zero; capture the actual result grid.
ROLLBACK TO before_empty_room;

PROMPT === G. Optional CRUD, package, geofence and alert demo ===
PROMPT Run 05_demo.sql once after a fresh setup; it inserts committed demo data.
PROMPT Capture steps 3, 5, 6, 8, 10 and 11 separately.
SPOOL OFF
