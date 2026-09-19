# Oracle SQL + PL/SQL Database Module

This folder is the relational-database implementation for the **Attendance Recorder / Attendly** application.

## Files

| File | Purpose |
|---|---|
| \`00_setup.sql\` | Master installer |
| \`01_schema.sql\` | Tables, constraints, indexes, and views |
| \`02_sample_data.sql\` | Reproducible classroom, student, session, and attendance sample data |
| \`03_plsql_program_units.sql\` | PL/SQL package and attendance audit trigger |
| \`04_queries.sql\` | Core SQL/reporting queries |
| \`05_demo.sql\` | Step-by-step project demonstration |
| \`REPORT.md\` | Submission-ready mini-project report |

## Database technology

The scripts target **Oracle Database 19c+ / Oracle Database Free** and use Oracle SQL and PL/SQL.

Recommended tools:

- Oracle SQL Developer
- Oracle SQLcl
- SQL*Plus
- Oracle Database Free 23ai/26ai for local installation

## Quick start

Open a terminal in this \`database\` directory and connect as your project schema:

\`\`\`sql
sqlplus username/password@service
\`\`\`

Then run:

\`\`\`sql
@00_setup.sql
@04_queries.sql
@05_demo.sql
\`\`\`

In SQL Developer, open each script and use **Run Script (F5)**, not only Run Statement.

## Relational model

The database uses six main tables:

1. **CLASSROOMS** — classroom metadata and geofence.
2. **STUDENTS** — student master data.
3. **CLASS_SESSIONS** — one teaching/attendance session per classroom/date.
4. **ATTENDANCE** — one row per student/session.
5. **PARENT_ALERTS** — absence notification queue/history.
6. **ATTENDANCE_AUDIT** — immutable-style history of attendance changes.

Important relationships:

\`\`\`text
CLASSROOMS 1 ───< STUDENTS
CLASSROOMS 1 ───< CLASS_SESSIONS
STUDENTS   1 ───< ATTENDANCE >─── 1 CLASS_SESSIONS
STUDENTS   1 ───< PARENT_ALERTS
ATTENDANCE 1 ───< PARENT_ALERTS
ATTENDANCE 1 ───< ATTENDANCE_AUDIT
\`\`\`

The unique constraint on \`ATTENDANCE(session_id, student_id)\` enforces the application's existing rule that a student can have only one attendance record for a given session.

## PL/SQL features

\`ATTENDANCE_PKG\` demonstrates:

- stored functions,
- stored procedures,
- parameters with defaults,
- \`MERGE\` for deterministic upserts,
- validation with \`RAISE_APPLICATION_ERROR\`,
- exception handling,
- reusable attendance-percentage analytics,
- geofence distance calculation,
- automatic absence creation,
- automatic parent-alert queue generation.

\`TRG_ATTENDANCE_AUDIT\` records INSERT, UPDATE, and DELETE changes to the attendance table.

## Relationship to the existing web app

The current app remains Firebase/offline-first so its deployed functionality is not broken. This Oracle module implements the same core domain as a normalized relational database for the SQL/PLSQL academic mini-project.

A production migration could replace Firestore calls in \`src/lib/attendanceStore.ts\` with an API backed by Oracle, while the React UI and facial-recognition flow remain largely unchanged.
