-- Attendly / Attendance Recorder
-- Core SQL queries for demonstration and report screenshots.

SET LINESIZE 180;
SET PAGESIZE 100;
SET SERVEROUTPUT ON;

PROMPT === 1. Student roster with classroom ===
SELECT
  s.student_id,
  s.roll_number,
  s.student_name,
  c.classroom_name,
  s.status
FROM students s
JOIN classrooms c ON c.classroom_id = s.classroom_id
ORDER BY s.roll_number;

PROMPT === 2. Daily attendance records for 18-Sep-2026 ===
SELECT
  s.roll_number,
  s.student_name,
  a.status,
  a.confidence,
  a.verification_method,
  TO_CHAR(a.recorded_at, 'HH24:MI:SS') AS recorded_time
FROM attendance a
JOIN students s ON s.student_id = a.student_id
JOIN class_sessions cs ON cs.session_id = a.session_id
WHERE cs.session_date = DATE '2026-09-18'
ORDER BY s.roll_number;

PROMPT === 3. Daily class summary ===
SELECT *
FROM v_daily_class_summary
ORDER BY session_date;

PROMPT === 4. Per-student attendance percentage ===
SELECT
  roll_number,
  student_name,
  total_sessions,
  present_count,
  late_count,
  absent_or_missing_count,
  attendance_percentage
FROM v_student_attendance_summary
ORDER BY attendance_percentage, roll_number;

PROMPT === 5. Students below 75 percent attendance ===
SELECT
  roll_number,
  student_name,
  attendance_percentage
FROM v_student_attendance_summary
WHERE attendance_percentage < 75
ORDER BY attendance_percentage;

PROMPT === 6. Count by attendance status ===
SELECT
  a.status,
  COUNT(*) AS record_count
FROM attendance a
GROUP BY a.status
ORDER BY a.status;

PROMPT === 7. Late-arrival ranking ===
SELECT
  s.roll_number,
  s.student_name,
  COUNT(*) AS late_count
FROM attendance a
JOIN students s ON s.student_id = a.student_id
WHERE a.status = 'LATE'
GROUP BY s.roll_number, s.student_name
ORDER BY late_count DESC, s.roll_number;

PROMPT === 8. Verification-method usage ===
SELECT
  verification_method,
  COUNT(*) AS records,
  ROUND(AVG(confidence), 2) AS average_confidence
FROM attendance
GROUP BY verification_method
ORDER BY records DESC;

PROMPT === 9. Pending/failed parent alerts ===
SELECT
  pa.alert_id,
  s.roll_number,
  s.student_name,
  pa.alert_date,
  pa.recipient_email,
  pa.alert_status
FROM parent_alerts pa
JOIN students s ON s.student_id = pa.student_id
WHERE pa.alert_status IN ('PENDING', 'FAILED')
ORDER BY pa.alert_date DESC, s.roll_number;

PROMPT === 10. Integrity check: duplicates should be zero ===
SELECT
  session_id,
  student_id,
  COUNT(*) AS duplicate_count
FROM attendance
GROUP BY session_id, student_id
HAVING COUNT(*) > 1;

PROMPT === 11. PL/SQL attendance percentage function ===
SELECT
  s.roll_number,
  s.student_name,
  attendance_pkg.attendance_percentage(
    s.student_id,
    DATE '2026-09-15',
    DATE '2026-09-18'
  ) AS percentage
FROM students s
ORDER BY s.roll_number;

PROMPT === 12. Geofence distance for a known point ===
SELECT
  ROUND(
    attendance_pkg.distance_meters(
      37.7749000, -122.4194000,
      c.latitude, c.longitude
    ),
    2
  ) AS distance_meters
FROM classrooms c
WHERE c.classroom_id = 'class-101';

PROMPT === 13. Audit trail ===
SELECT
  audit_id,
  attendance_id,
  action_type,
  old_status,
  new_status,
  changed_by,
  TO_CHAR(changed_at, 'YYYY-MM-DD HH24:MI:SS') AS changed_at
FROM attendance_audit
ORDER BY audit_id;
