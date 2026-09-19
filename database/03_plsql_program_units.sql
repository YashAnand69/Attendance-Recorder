-- Attendly / Attendance Recorder
-- PL/SQL package + trigger.
-- Requires database/01_schema.sql and database/02_sample_data.sql.

SET SERVEROUTPUT ON;
SET DEFINE OFF;

BEGIN
  EXECUTE IMMEDIATE 'DROP TRIGGER trg_attendance_audit';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -4080 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'DROP PACKAGE attendance_pkg';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -4043 THEN RAISE; END IF;
END;
/

CREATE OR REPLACE PACKAGE attendance_pkg AS
  FUNCTION distance_meters(
    p_lat1 NUMBER,
    p_lon1 NUMBER,
    p_lat2 NUMBER,
    p_lon2 NUMBER
  ) RETURN NUMBER DETERMINISTIC;

  FUNCTION attendance_percentage(
    p_student_id VARCHAR2,
    p_from_date  DATE DEFAULT NULL,
    p_to_date    DATE DEFAULT NULL
  ) RETURN NUMBER;

  PROCEDURE mark_attendance(
    p_student_id          IN  VARCHAR2,
    p_session_id          IN  NUMBER,
    p_status              IN  VARCHAR2,
    p_attendance_id       OUT NUMBER,
    p_confidence          IN  NUMBER   DEFAULT NULL,
    p_latitude            IN  NUMBER   DEFAULT NULL,
    p_longitude           IN  NUMBER   DEFAULT NULL,
    p_verification_method IN  VARCHAR2 DEFAULT 'MANUAL',
    p_synced_offline      IN  CHAR     DEFAULT 'N',
    p_notes               IN  VARCHAR2 DEFAULT NULL
  );

  PROCEDURE mark_absentees(
    p_session_id IN NUMBER
  );

  PROCEDURE generate_absence_alerts(
    p_session_id IN NUMBER
  );
END attendance_pkg;
/

CREATE OR REPLACE PACKAGE BODY attendance_pkg AS

  FUNCTION distance_meters(
    p_lat1 NUMBER,
    p_lon1 NUMBER,
    p_lat2 NUMBER,
    p_lon2 NUMBER
  ) RETURN NUMBER DETERMINISTIC IS
    c_earth_radius CONSTANT NUMBER := 6371000;
    c_pi           CONSTANT NUMBER := ACOS(-1);
    v_lat1         NUMBER;
    v_lat2         NUMBER;
    v_delta_lat    NUMBER;
    v_delta_lon    NUMBER;
    v_a            NUMBER;
  BEGIN
    IF p_lat1 IS NULL OR p_lon1 IS NULL OR p_lat2 IS NULL OR p_lon2 IS NULL THEN
      RETURN NULL;
    END IF;

    v_lat1      := p_lat1 * c_pi / 180;
    v_lat2      := p_lat2 * c_pi / 180;
    v_delta_lat := (p_lat2 - p_lat1) * c_pi / 180;
    v_delta_lon := (p_lon2 - p_lon1) * c_pi / 180;

    v_a :=
        POWER(SIN(v_delta_lat / 2), 2)
      + COS(v_lat1) * COS(v_lat2) * POWER(SIN(v_delta_lon / 2), 2);

    RETURN c_earth_radius * 2 * ASIN(SQRT(LEAST(1, v_a)));
  END distance_meters;


  FUNCTION attendance_percentage(
    p_student_id VARCHAR2,
    p_from_date  DATE DEFAULT NULL,
    p_to_date    DATE DEFAULT NULL
  ) RETURN NUMBER IS
    v_classroom_id  students.classroom_id%TYPE;
    v_total         NUMBER := 0;
    v_attended      NUMBER := 0;
  BEGIN
    SELECT classroom_id
      INTO v_classroom_id
      FROM students
     WHERE student_id = p_student_id;

    SELECT COUNT(*),
           NVL(SUM(CASE WHEN a.status IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END), 0)
      INTO v_total, v_attended
      FROM class_sessions cs
      LEFT JOIN attendance a
        ON a.session_id = cs.session_id
       AND a.student_id = p_student_id
     WHERE cs.classroom_id = v_classroom_id
       AND cs.session_status <> 'CANCELLED'
       AND (p_from_date IS NULL OR cs.session_date >= TRUNC(p_from_date))
       AND (p_to_date   IS NULL OR cs.session_date <= TRUNC(p_to_date));

    IF v_total = 0 THEN
      RETURN 0;
    END IF;

    RETURN ROUND((v_attended / v_total) * 100, 2);
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20001, 'Unknown student_id: ' || p_student_id);
  END attendance_percentage;


  PROCEDURE mark_attendance(
    p_student_id          IN  VARCHAR2,
    p_session_id          IN  NUMBER,
    p_status              IN  VARCHAR2,
    p_attendance_id       OUT NUMBER,
    p_confidence          IN  NUMBER   DEFAULT NULL,
    p_latitude            IN  NUMBER   DEFAULT NULL,
    p_longitude           IN  NUMBER   DEFAULT NULL,
    p_verification_method IN  VARCHAR2 DEFAULT 'MANUAL',
    p_synced_offline      IN  CHAR     DEFAULT 'N',
    p_notes               IN  VARCHAR2 DEFAULT NULL
  ) IS
    v_student_classroom  students.classroom_id%TYPE;
    v_student_status     students.status%TYPE;
    v_session_classroom  class_sessions.classroom_id%TYPE;
    v_session_status     class_sessions.session_status%TYPE;
    v_class_lat          classrooms.latitude%TYPE;
    v_class_lon          classrooms.longitude%TYPE;
    v_radius             classrooms.radius_meters%TYPE;
    v_distance           NUMBER;
    v_status             VARCHAR2(10) := UPPER(TRIM(p_status));
    v_method             VARCHAR2(20) := UPPER(TRIM(p_verification_method));
    v_sync               CHAR(1) := UPPER(TRIM(p_synced_offline));
  BEGIN
    BEGIN
      SELECT classroom_id, status
        INTO v_student_classroom, v_student_status
        FROM students
       WHERE student_id = p_student_id;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20001, 'Unknown student_id: ' || p_student_id);
    END;

    IF v_student_status <> 'ACTIVE' THEN
      RAISE_APPLICATION_ERROR(-20002, 'Attendance cannot be recorded for an inactive student.');
    END IF;

    BEGIN
      SELECT cs.classroom_id, cs.session_status, c.latitude, c.longitude, c.radius_meters
        INTO v_session_classroom, v_session_status, v_class_lat, v_class_lon, v_radius
        FROM class_sessions cs
        JOIN classrooms c
          ON c.classroom_id = cs.classroom_id
       WHERE cs.session_id = p_session_id;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20003, 'Unknown session_id: ' || p_session_id);
    END;

    IF v_student_classroom <> v_session_classroom THEN
      RAISE_APPLICATION_ERROR(-20004, 'Student does not belong to the session classroom.');
    END IF;

    IF v_session_status = 'CANCELLED' THEN
      RAISE_APPLICATION_ERROR(-20005, 'Attendance cannot be recorded for a cancelled session.');
    END IF;

    IF v_status NOT IN ('PRESENT', 'ABSENT', 'LATE') THEN
      RAISE_APPLICATION_ERROR(-20006, 'Invalid attendance status.');
    END IF;

    IF v_method NOT IN ('FACE_RECOGNITION', 'MANUAL', 'OFFLINE_SYNC') THEN
      RAISE_APPLICATION_ERROR(-20007, 'Invalid verification method.');
    END IF;

    IF v_sync NOT IN ('Y', 'N') THEN
      RAISE_APPLICATION_ERROR(-20008, 'synced_offline must be Y or N.');
    END IF;

    IF p_confidence IS NOT NULL AND (p_confidence < 0 OR p_confidence > 100) THEN
      RAISE_APPLICATION_ERROR(-20009, 'Confidence must be between 0 and 100.');
    END IF;

    -- Face-recognition attendance is accepted only inside the configured geofence.
    IF v_method = 'FACE_RECOGNITION' THEN
      IF p_latitude IS NULL OR p_longitude IS NULL THEN
        RAISE_APPLICATION_ERROR(-20010, 'Face-recognition attendance requires latitude and longitude.');
      END IF;

      v_distance := distance_meters(p_latitude, p_longitude, v_class_lat, v_class_lon);

      IF v_distance > v_radius THEN
        RAISE_APPLICATION_ERROR(
          -20011,
          'Geofence verification failed. Distance=' || ROUND(v_distance, 1)
          || 'm, allowed=' || v_radius || 'm.'
        );
      END IF;
    END IF;

    -- MERGE implements the app's one-record-per-student-per-session rule.
    MERGE INTO attendance a
    USING (
      SELECT p_session_id AS session_id, p_student_id AS student_id
      FROM dual
    ) src
       ON (a.session_id = src.session_id AND a.student_id = src.student_id)
    WHEN MATCHED THEN
      UPDATE SET
        a.recorded_at         = SYSTIMESTAMP,
        a.status              = v_status,
        a.confidence          = p_confidence,
        a.latitude            = p_latitude,
        a.longitude           = p_longitude,
        a.verification_method = v_method,
        a.synced_offline      = v_sync,
        a.notes               = p_notes
    WHEN NOT MATCHED THEN
      INSERT (
        session_id, student_id, recorded_at, status, confidence,
        latitude, longitude, verification_method, synced_offline, notes
      )
      VALUES (
        p_session_id, p_student_id, SYSTIMESTAMP, v_status, p_confidence,
        p_latitude, p_longitude, v_method, v_sync, p_notes
      );

    SELECT attendance_id
      INTO p_attendance_id
      FROM attendance
     WHERE session_id = p_session_id
       AND student_id = p_student_id;
  END mark_attendance;


  PROCEDURE mark_absentees(
    p_session_id IN NUMBER
  ) IS
    v_classroom_id class_sessions.classroom_id%TYPE;
  BEGIN
    SELECT classroom_id
      INTO v_classroom_id
      FROM class_sessions
     WHERE session_id = p_session_id;

    INSERT INTO attendance (
      session_id, student_id, recorded_at, status,
      verification_method, synced_offline, notes
    )
    SELECT
      p_session_id,
      s.student_id,
      SYSTIMESTAMP,
      'ABSENT',
      'MANUAL',
      'N',
      'Automatically marked absent after attendance window'
    FROM students s
    WHERE s.classroom_id = v_classroom_id
      AND s.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1
        FROM attendance a
        WHERE a.session_id = p_session_id
          AND a.student_id = s.student_id
      );
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20003, 'Unknown session_id: ' || p_session_id);
  END mark_absentees;


  PROCEDURE generate_absence_alerts(
    p_session_id IN NUMBER
  ) IS
  BEGIN
    MERGE INTO parent_alerts pa
    USING (
      SELECT
        a.attendance_id,
        a.student_id,
        cs.session_date,
        s.parent_email,
        s.student_name,
        s.roll_number
      FROM attendance a
      JOIN students s
        ON s.student_id = a.student_id
      JOIN class_sessions cs
        ON cs.session_id = a.session_id
      WHERE a.session_id = p_session_id
        AND a.status = 'ABSENT'
        AND s.parent_email IS NOT NULL
    ) src
       ON (
         pa.student_id = src.student_id
         AND pa.alert_date = src.session_date
       )
    WHEN MATCHED THEN
      UPDATE SET
        pa.attendance_id   = src.attendance_id,
        pa.recipient_email = src.parent_email,
        pa.message         = 'Attendance notice: ' || src.student_name
                             || ' (' || src.roll_number || ') was marked absent.',
        pa.alert_status    = CASE WHEN pa.alert_status = 'SENT' THEN 'SENT' ELSE 'PENDING' END
    WHEN NOT MATCHED THEN
      INSERT (
        attendance_id, student_id, alert_date, recipient_email,
        alert_status, message
      )
      VALUES (
        src.attendance_id, src.student_id, src.session_date, src.parent_email,
        'PENDING',
        'Attendance notice: ' || src.student_name
        || ' (' || src.roll_number || ') was marked absent.'
      );
  END generate_absence_alerts;

END attendance_pkg;
/

CREATE OR REPLACE TRIGGER trg_attendance_audit
AFTER INSERT OR UPDATE OR DELETE ON attendance
FOR EACH ROW
DECLARE
  v_action VARCHAR2(10);
BEGIN
  IF INSERTING THEN
    v_action := 'INSERT';
  ELSIF UPDATING THEN
    v_action := 'UPDATE';
  ELSE
    v_action := 'DELETE';
  END IF;

  INSERT INTO attendance_audit (
    attendance_id,
    action_type,
    old_status,
    new_status,
    details
  ) VALUES (
    NVL(:NEW.attendance_id, :OLD.attendance_id),
    v_action,
    :OLD.status,
    :NEW.status,
    'student=' || NVL(:NEW.student_id, :OLD.student_id)
    || '; session=' || NVL(TO_CHAR(:NEW.session_id), TO_CHAR(:OLD.session_id))
  );
END;
/

PROMPT PL/SQL package and audit trigger created successfully.
