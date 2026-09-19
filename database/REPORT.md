# Database Mini-Project Report  
## Attendance Recorder (Attendly)

**Selected database technology:** Oracle Database with SQL and PL/SQL  
**Application:** Smart classroom attendance recording using face verification, geofencing, offline synchronization, analytics, and parent alerts  
**Repository:** \`YashAnand69/Attendance-Recorder\`

---

## 1. Abstract

Attendance Recorder, branded in the application as **Attendly**, is a smart classroom attendance application. The existing web application supports student enrollment, face-based attendance verification, classroom geofence validation, manual correction, offline queuing, attendance dashboards, reports, and parent absence notifications.

This mini-project implements the application's data layer using a normalized **Oracle relational database**. SQL is used for schema definition, constraints, data manipulation, joins, aggregations, analytical views, and reporting. PL/SQL is used to move important business rules into the database through reusable procedures, functions, exception handling, an attendance package, and an audit trigger.

The implementation is designed to preserve the functional behavior already present in the application while demonstrating relational database concepts required for a database systems mini-project.

---

## 2. Problem Statement

Traditional attendance systems are vulnerable to duplicate records, proxy attendance, inconsistent manual records, and poor reporting. Attendly attempts to improve attendance recording using:

- registered student identities,
- facial verification,
- physical classroom geofence validation,
- one attendance record per student per class session,
- manual administrative correction,
- offline synchronization,
- parent alerts for absence,
- attendance-percentage analytics.

The database must store this information with strong consistency and must prevent invalid or duplicate attendance records.

---

## 3. Objectives

The database implementation has the following objectives:

1. Design a normalized relational model for attendance management.
2. Maintain referential and domain integrity using primary keys, foreign keys, unique constraints, and CHECK constraints.
3. Store sample datasets that represent realistic classroom attendance.
4. Support CRUD operations and analytical SQL queries.
5. Implement reusable business logic using PL/SQL.
6. Prevent duplicate attendance for the same student and session.
7. Validate geofence-based face-recognition attendance.
8. Automatically mark missing students absent.
9. Generate parent alert records for absent students.
10. Maintain an audit history of attendance changes.
11. Produce classroom and student-level attendance reports.

---

## 4. Existing Application Analysis

The GitHub project is a React/TypeScript application with an offline-first attendance store. Its existing domain contains four principal application entities:

- **Student**
- **Classroom**
- **AttendanceRecord**
- **ParentAlert**

The application currently writes attendance deterministically using the logical key **student + date**, prevents duplicate scans, supports facial and manual verification methods, stores confidence and location, and synchronizes offline records when a network connection returns.

The relational implementation refines that design by introducing **CLASS_SESSIONS**. A session becomes the parent of attendance records, avoiding repeated class/date metadata and allowing future support for multiple sessions, topics, start/end times, and cancellation states.

---

## 5. Database Schema / Model Design

### 5.1 Entities

### CLASSROOMS

Stores the physical classroom and its geofence configuration.

Key attributes:

- \`classroom_id\` — primary key
- \`classroom_name\`
- \`latitude\`
- \`longitude\`
- \`radius_meters\`
- \`teacher_name\`

### STUDENTS

Stores one row per enrolled student.

Key attributes:

- \`student_id\` — primary key
- \`roll_number\` — unique
- \`student_name\`
- \`classroom_id\` — foreign key
- parent contact details
- face image reference
- active/inactive status

### CLASS_SESSIONS

Represents a scheduled attendance event.

Key attributes:

- \`session_id\` — identity primary key
- \`classroom_id\` — foreign key
- \`session_date\`
- \`start_time\`
- \`end_time\`
- \`topic\`
- \`session_status\`

A unique constraint on classroom and date protects the current one-session-per-classroom-per-day design.

### ATTENDANCE

Stores the result for one student in one session.

Key attributes:

- \`attendance_id\` — identity primary key
- \`session_id\` — foreign key
- \`student_id\` — foreign key
- \`status\` — PRESENT / ABSENT / LATE
- \`confidence\`
- \`latitude\`, \`longitude\`
- \`verification_method\`
- offline synchronization flag
- notes

The constraint:

\`\`\`sql
UNIQUE (session_id, student_id)
\`\`\`

guarantees that duplicate scans cannot create conflicting rows for a student in the same session.

### PARENT_ALERTS

Stores absence notification records.

Important fields include student, attendance row, alert date, destination email, status, sent timestamp, and message.

### ATTENDANCE_AUDIT

Stores the database history of attendance INSERT, UPDATE, and DELETE operations.

---

## 6. ER Relationship Summary

\`\`\`text
CLASSROOMS 1 ───< STUDENTS
CLASSROOMS 1 ───< CLASS_SESSIONS

STUDENTS 1 ───< ATTENDANCE >─── 1 CLASS_SESSIONS

STUDENTS 1 ───< PARENT_ALERTS
ATTENDANCE 1 ───< PARENT_ALERTS

ATTENDANCE 1 ───< ATTENDANCE_AUDIT
\`\`\`

This model separates master data, event data, transaction data, and audit data.

---

## 7. Normalization

The schema is designed to approximately **Third Normal Form (3NF)**.

### First Normal Form

Each column stores an atomic value. Attendance status, student name, roll number, and other values are represented in individual columns.

### Second Normal Form

Transaction attributes depend on their complete logical key. Student details are not stored repeatedly in the attendance table. They are referenced using \`student_id\`.

### Third Normal Form

Classroom name, teacher name, and geofence details are stored in CLASSROOMS instead of being duplicated across STUDENTS or ATTENDANCE. Session-specific information is stored in CLASS_SESSIONS instead of being repeated for every student's attendance row.

This reduces update anomalies and storage redundancy.

---

## 8. SQL Implementation

The SQL implementation includes:

- six relational tables,
- primary keys,
- foreign keys,
- unique constraints,
- CHECK constraints,
- indexes,
- identity columns,
- two reporting views.

### Integrity examples

Student status is restricted to:

\`\`\`sql
CHECK (status IN ('ACTIVE', 'INACTIVE'))
\`\`\`

Attendance status is restricted to:

\`\`\`sql
CHECK (status IN ('PRESENT', 'ABSENT', 'LATE'))
\`\`\`

Face confidence is restricted to the range 0–100.

Coordinates are also constrained to valid latitude/longitude ranges.

---

## 9. PL/SQL Implementation

The database contains a package named:

\`\`\`text
ATTENDANCE_PKG
\`\`\`

### 9.1 \`distance_meters\`

Calculates physical distance between two GPS coordinates using the Haversine formula.

Purpose: reproduce the application's classroom geofence check at the database layer.

### 9.2 \`attendance_percentage\`

Calculates a student's attendance percentage for a configurable date range.

PRESENT and LATE are counted as attended sessions.

### 9.3 \`mark_attendance\`

Central attendance procedure.

It validates:

- student existence,
- active student status,
- session existence,
- matching classroom,
- cancelled sessions,
- allowed attendance status,
- allowed verification method,
- confidence range,
- geofence requirement for face-recognition attendance.

It uses Oracle \`MERGE\` so repeated scans update the existing student/session record instead of creating duplicates.

### 9.4 \`mark_absentees\`

Uses an INSERT...SELECT statement to automatically create ABSENT rows for active students who do not yet have attendance for a given session.

### 9.5 \`generate_absence_alerts\`

Creates or updates parent-alert queue rows for absent students.

### 9.6 Attendance Audit Trigger

The row-level trigger \`TRG_ATTENDANCE_AUDIT\` records:

- INSERT,
- UPDATE,
- DELETE,
- old status,
- new status,
- user,
- timestamp.

This is useful when an administrator manually corrects attendance.

---

## 10. Sample Dataset

The supplied sample dataset includes:

- 1 classroom,
- 8 students,
- 4 completed class sessions,
- 32 attendance rows.

The data contains a mixture of:

- PRESENT,
- LATE,
- ABSENT,
- face-recognition records,
- manual absence records.

This allows meaningful aggregate queries instead of demonstrating only trivial data.

---

## 11. Core Operations Demonstrated

### CREATE

A new class session is inserted.

### READ

Student, classroom, session, and attendance information is retrieved using JOINs and views.

### UPDATE

The PL/SQL \`mark_attendance\` procedure changes an existing attendance row through deterministic upsert behavior.

### DELETE

An attendance record is deleted in the demonstration and its deletion is recorded by the audit trigger.

---

## 12. Technology-Specific Queries and Features

The implementation demonstrates Oracle-specific or advanced relational features including:

- PL/SQL packages,
- stored procedures,
- stored functions,
- \`RAISE_APPLICATION_ERROR\`,
- exception handling,
- \`MERGE\`,
- row-level triggers,
- identity columns,
- views,
- \`SYS_CONTEXT\`,
- anonymous PL/SQL blocks,
- SQL*Plus bind variables,
- aggregate queries,
- JOINs,
- GROUP BY,
- conditional aggregation.

---

## 13. Important Analytical Queries

The query file demonstrates:

1. student roster with classroom,
2. daily attendance,
3. daily class summary,
4. per-student attendance percentage,
5. students below 75% attendance,
6. status distribution,
7. late-arrival ranking,
8. verification-method usage,
9. pending parent alerts,
10. duplicate-data integrity check,
11. PL/SQL attendance percentage function,
12. geofence-distance function,
13. attendance audit history.

---

## 14. Why Oracle SQL / PL/SQL Is Suitable

Attendance is structured, relational, and integrity-sensitive. A relational database is suitable because the system has strong relationships among students, classrooms, sessions, attendance, and alerts.

### Advantages for this application

**Strong integrity:** Foreign keys and CHECK constraints prevent many invalid states before they reach the application.

**Transaction support:** Attendance updates, absence generation, and alert generation can be handled atomically.

**Duplicate prevention:** A database unique constraint reliably enforces one attendance record per student/session even under concurrent access.

**Rich reporting:** Attendance systems require joins, percentages, aggregates, and date-based reports, which SQL handles naturally.

**Server-side business rules:** PL/SQL packages allow core validation to remain centralized and reusable.

**Auditing:** Triggers can record administrative changes independent of the user interface.

**Performance:** Indexes and set-based SQL scale well for common roster and attendance queries.

---

## 15. Comparative Analysis

| Requirement | Oracle Relational DB | Firebase Firestore |
|---|---|---|
| Strong multi-table relationships | Excellent | Application-managed |
| Foreign-key enforcement | Native | Not native |
| Complex joins | Native SQL | Usually application-side |
| Aggregate reports | Strong | Often requires additional logic |
| Transactions | Strong ACID support | Supported, document-oriented |
| Stored procedures/functions | PL/SQL | Not equivalent |
| Triggers/audit logic | Native database triggers | Usually Cloud Functions / app logic |
| Offline browser sync | Requires application layer | Excellent built-in fit |
| Flexible document schema | More rigid | Excellent |
| Academic SQL/PLSQL demonstration | Excellent | Not suitable for PL/SQL coursework |

The existing application uses Firebase effectively for offline-first browser synchronization. However, **Oracle is more suitable for this database mini-project** because the coursework explicitly requires SQL and PL/SQL and because attendance records benefit from normalized relationships, constraints, transactions, analytical SQL, stored program units, and auditability.

A practical production architecture could use the React front end with an API connected to Oracle while retaining a browser-side offline queue.

---

## 16. Testing Strategy

The demonstration verifies the following test cases:

| Test | Expected result |
|---|---|
| Insert a class session | Session created |
| Mark valid face attendance inside geofence | Attendance inserted |
| Repeat same student/session | Existing row updated, not duplicated |
| Face attendance outside geofence | PL/SQL exception raised |
| Automatically mark missing students | Missing rows become ABSENT |
| Generate absence alerts | PENDING alert rows created |
| Update attendance | Audit UPDATE record created |
| Delete attendance | Audit DELETE record created |
| Query duplicate student/session records | Zero rows |
| Calculate attendance percentage | Percentage returned by stored function |

---

## 17. Security and Privacy Considerations

The application works with biometric-related data. The database therefore stores only a face image reference in this academic implementation rather than raw camera frames.

A production system should additionally implement:

- role-based database privileges,
- encrypted network connections,
- encrypted storage,
- minimal biometric retention,
- consent management,
- secure API authentication,
- audit-log retention,
- restricted parent contact access.

---

## 18. Project Demonstration Flow

The recommended demonstration is:

1. Run \`00_setup.sql\`.
2. Show the six tables and two views.
3. Show the eight-student sample roster.
4. Run \`04_queries.sql\` and explain at least three reports.
5. Run \`05_demo.sql\`.
6. Highlight the PL/SQL package call that marks attendance.
7. Show the duplicate-safe \`MERGE\`.
8. Show automatic absence creation.
9. Show generated parent alerts.
10. Show the expected geofence exception.
11. Show INSERT/UPDATE/DELETE rows captured in ATTENDANCE_AUDIT.
12. Finish with the student attendance-percentage report.

---

## 19. Conclusion

The Attendance Recorder database implementation converts the application's existing attendance model into a normalized Oracle relational design. SQL constraints preserve data quality, analytical queries support administrative reporting, and PL/SQL centralizes domain rules such as geofence validation, absence processing, alert generation, percentage calculation, and audit history.

The resulting database is suitable for an academic SQL/PLSQL mini-project while remaining directly connected to the behavior and entities of the existing Attendly application.
