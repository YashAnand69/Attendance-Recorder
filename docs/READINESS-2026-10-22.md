# Attendly readiness review, 22 October 2026

## Verdict

The core application is suitable for a supervised classroom project demonstration after camera/location rehearsal. It is not a completed institutional attendance system. The live Vercel app uses private Blob JSON storage. The separate Oracle SQL/PLSQL module has not been connected to the website or executed on an Oracle instance during this review.

## Corrections

- Removed a leftover 30-student recognition limit.
- Stop registration camera tracks when the form closes, a delayed permission response arrives, or the component unmounts.
- Added Late to PDF reports and repeated column headings on later pages.
- Filtered report trends by the current roster and deduplicated student/day rows.
- Reject impossible dates and unknown student IDs in attendance writes.
- Added a demo-only reset for fresh sample records with current dates.
- Added a workspace recovery screen for rendering or page-loading failures.

## Verified

- TypeScript checks, seven automated tests and the production frontend build.
- Live login, invalid-password rejection, signed-in storage reads and anonymous denial.
- Temporary student and attendance writes, readback, daily-key update/deduplication, camera-snapshot stripping and cross-origin rejection. Temporary records were removed.
- Browser login and empty real workspace loading.
- Demo reset, student search, manual attendance, persistence after reload, monthly reports and local insight calculations.
- Downloaded and visually checked the PDF report with separate Present, Late and Absent columns.

## Remaining limits

- Real camera recognition accuracy, lighting, browser permissions and actual GPS must be rehearsed with a consenting participant.
- No liveness/anti-spoofing mechanism, individual user roles or immutable cloud audit trail.
- No configured email/Gemini providers on the fresh Vercel project.
- Manual backups only. No scheduled restore service or complete historical erasure workflow.
- Blob collection reads and browser calculations suit a small classroom. No school-scale performance benchmark or concurrent-device conflict review.
- Oracle setup, query execution and API integration remain separate work. Current Oracle IDs and session rules need mapping before a migration.

## DBMS presentation boundary

Explain primary/foreign/unique keys, CHECK/NOT NULL/defaults, normalization, joins and aggregates, views, indexes, PL/SQL package functions/procedures, MERGE, exceptions, triggers and transaction behavior using the Oracle source.

Do not claim those Oracle guarantees already protect the Blob implementation. The live API validates a subset of the rules. Oracle audit trigger inserts share the attendance transaction and roll back with it. The audit table holds a logical attendance reference without a declared foreign key.
