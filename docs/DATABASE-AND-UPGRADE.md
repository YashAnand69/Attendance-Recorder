# Attendly v2 — upgrade and database guide

> Historical Netlify deployment notes. The new Vercel workspace starts fresh in private Vercel Blob storage. See [VERCEL-DATABASE.md](VERCEL-DATABASE.md) for its current architecture; the Netlify records remain untouched.

## Oracle SQL/PLSQL module in this repository

The newer database/ directory is preserved. It is a separate Oracle 19c+/Oracle Database Free academic implementation, with CLASSROOMS, STUDENTS, CLASS_SESSIONS, ATTENDANCE, PARENT_ALERTS and ATTENDANCE_AUDIT tables. It includes relationships/constraints, attendance stored procedures/functions, a MERGE upsert flow, geofence logic and an attendance audit trigger.

It is not wired into the React/Netlify runtime. Merely committing its SQL files does not provision an Oracle server. Its data is stored in whichever Oracle instance/schema you install it into using database/00_setup.sql. No Oracle instance was configured or executed in this task, and no SQL data was migrated into or out of Netlify Blobs.

The SQL model records attendance per student/session; the current web app uses student/calendar-day keys. Integrating Oracle would require a protected backend connection, Oracle deployment/credentials and a deliberate migration between those models. The SQL audit trigger applies only to Oracle records; it does not audit the Netlify store.


Prepared 27 September 2026.

## Delivery status

The v2 changes are implemented and tested locally. Publishing was attempted, but Netlify returned Forbidden. The Netlify connector explicitly requires reauthentication. Until deployment succeeds, the live site continues to serve the previous version and its previous access behavior. The new administrator password is prepared locally but must be configured on Netlify before v2 can be used with cloud data.

## What changed

- A redesigned responsive workspace with a dark green sidebar, light content area, lime accents, overview metrics, a seven-day chart, mobile navigation and dedicated pages.
- Searchable, status-filtered attendance table with pagination, date selection, instant manual updates and CSV export.
- Unmarked attendance is distinct from an explicit absence on the overview. Late arrivals count as attended.
- Demo data and real cloud data are separate. Trying the public demo never writes to the real database.
- A protected cloud workspace using server-verified administrator login. No password is embedded in the new frontend.
- Visible pending changes, sync failures, last successful sync, retry controls and JSON backup download.
- Attendance writes use a stable student/date key, preventing duplicate daily rows.
- Offline mutations for student additions/deletions, attendance and classroom settings persist until acknowledged by the server.
- Local-calendar dates replace UTC date slicing in the scanner.
- GPS denial no longer substitutes the classroom's coordinates or claims successful verification.
- Photo simulation is now a test only and never writes attendance.
- Multiple faces in a live frame are rejected. The 30-student matching cap is removed. Similarity is labelled as a score rather than a calibrated probability.
- New camera snapshots are not saved with attendance.
- CSV output escapes quotes and spreadsheet formula prefixes.
- Roster registration rejects duplicate roll numbers within the loaded roster, unsupported photo types and files larger than 8 MB.
- Camera registration tracks are stopped on unmount; model loading can retry after failure.

## Where the database lives

The active cloud store is **Netlify Blobs**, attached to project **attendly-attendance**, project ID **2e901f34-26b1-48f6-bc69-4a8d6a35338a**, under **YashAnand69’s team**.

Store name: **attendly-attendance**.

Open the project in Netlify and select **Data & storage → Blobs**. The store belongs to the site and survives normal redeployments.

This is an object/key-value store holding JSON documents, not a SQL database. Netlify manages the physical storage. No specific physical data-residency region was established or verified during this work.

The repository still contains the old Firebase configuration (project root-protocol-g3n78 and its named AI Studio Firestore database). It is legacy code; the v2 attendance data layer does not import Firebase or use Firestore. Existing Netlify records are preserved in their existing store and key layout. No historical data was deleted or migrated to another provider.

## Stored documents

| Key prefix | Contents |
| --- | --- |
| students/<student-id> | Student name, roll number, class, guardian email/phone, enrolled face photo, active status, creation/update timestamps |
| classrooms/<classroom-id> | Classroom name, instructor, latitude, longitude and allowed radius |
| attendance_logs/att-YYYY-MM-DD-<student-id> | Student identity/name, date/time, status, method, score and coordinates; one row per student/day |
| parent_alerts/<alert-id> | Alert recipient, student, date, send status and message |

Records are JSON. Uploaded enrollment photos are compressed by the browser and stored as image data URLs inside student documents. They are not saved in a separate public image bucket. Existing demo student photos may be external Unsplash URLs.

New writes receive a server-generated updatedAt timestamp. Existing records are preserved as-is, including any legacy snapshots or demo rows previously saved to the cloud.

Deleting a student removes the profile document. Historical attendance and parent-alert records are intentionally not cascaded; they may still contain names and related details. There is no complete “erase all data for this person” workflow yet.

## Read and write flow

1. The browser checks /api/session to determine whether it has a valid administrator session.
2. Signed-in clients load /api/attendance-data. Server-side functions access Netlify Blobs using Netlify's deployment context; storage credentials are never shipped in the browser.
3. Edits update the browser immediately. Each cloud edit is also persisted to an offline queue.
4. The queue sends POST mutations to /api/attendance-data. A mutation is removed only when the request succeeds.
5. A version ID prevents an older successful request from removing a newer edit queued while that request was running.
6. The workspace refreshes every 20 seconds while visible, when the browser becomes visible again, and on reconnection. Local pending changes are overlaid on the latest server response.
7. A retry button is available in settings.

This is periodic refresh, not WebSocket real-time collaboration. Netlify Blobs is configured for strong consistency. Simultaneous edits from multiple devices use last accepted write wins; there is no database transaction, revision-conflict UI, or immutable audit history. Duplicate roll checking is currently client-side, so concurrent enrollment on different devices can still create duplicate roll numbers.

## Browser storage

| localStorage key | Purpose |
| --- | --- |
| attendly_demo_v4 | Demo workspace and demo edits, isolated from cloud |
| attendly_cloud_v4 | Last loaded real workspace for offline use |
| attendly_pending_v4 | Cloud changes waiting for acknowledgement |
| attendly_offline_until | Local expiry marker for reopening a previously signed-in workspace offline; this is not a server credential |

These browser records are plain JSON, not encrypted by the app. Use trusted devices for real student data. Signing out clears the v4 cloud cache, but keeps unsynced mutations so they are not lost. Clear browser data only after syncing or exporting records. Browser storage has a quota; large rosters/photos can exhaust it.

Older smart_attendance_* caches are left untouched to avoid silently discarding old local data. They are not automatically imported into v2. If an old device has pending offline records, export/recover them before clearing its browser data. Demo data is never auto-seeded into the real store in v2.

## Authentication and authorization

The v2 frontend sends the workspace password to /api/session over HTTPS. The function compares its SHA-256 hash against ATTENDLY_PASSWORD_HASH. A randomly generated high-entropy password is prepared in a separate private local handoff file; it replaces the password formerly embedded in public source.

Successful login sets a signed, 12-hour, HttpOnly, Secure, SameSite=Strict cookie. ATTENDLY_SESSION_SECRET signs the cookie and stays on the server. Data, email and AI endpoints reject unauthenticated calls. Non-GET requests with an unrelated Origin are rejected.

This is one administrator workspace, not individual student accounts, MFA, role-based school administration or multi-tenant isolation. The login has an in-memory per-instance attempt limit; it is not a distributed abuse-prevention service. Rotating the signing secret revokes existing cookies after deployment. Signing out removes the browser cookie.

The old deployed data endpoint was readable without a login during inspection. The new checks will protect it only once v2 is deployed. Deployment is therefore a required final step, not merely a cosmetic publishing step.

## Face recognition

The browser downloads bundled models from /models, computes face descriptors, and compares them locally with enrolled photos. Descriptors are cached in memory for matching. New raw camera frames are discarded after matching and are omitted from new attendance records. Face matching itself does not call Gemini.

A match score is not proof of identity. There is no liveness or anti-spoofing system; a photograph can fool a face matcher. Location comes from browser GPS and is also not tamper-proof. This version is intended for supervised classroom use, with manual correction available. Real-camera accuracy across lighting, ages and devices still requires testing with consenting participants.

## Reports and optional services

The overview counts present and late as attended, with unmarked separate from absent. Monthly reporting uses observed attendance days by default; administrators can override the school-day count. Monthly “absent” totals include the remaining days in that chosen denominator, so review the day count before using the report for decisions.

CSV and PDF reports remain available. Local deterministic summaries work without an AI provider. If GEMINI_API_KEY is configured, the explicit Generate insights action sends student IDs/names and date/status records to Gemini; it omits enrolled photos, raw snapshots, guardian contacts and GPS.

Parent email requires RESEND_API_KEY and ATTENDANCE_FROM_EMAIL. Without those settings, email delivery is unavailable. No parent emails were sent during verification. Sending an alert shares the intended guardian address and attendance notice with Resend.

## Backups, retention and scale

Settings → Download backup exports the currently loaded workspace as JSON, including personal information and enrolled photos. Store that file securely. This is a manual export, not a scheduled backup, automated restore, or full recovery guarantee.

No automatic retention/deletion policy is configured. Record removal and historical cleanup require deliberate administration. There is no backup-import button yet.

The current API loads the complete roster, attendance, classrooms and alert history. This is practical for a small classroom prototype; a large school should add pagination, indexed queries, per-class permissions, stronger authentication, conflict handling, managed backups and an explicit retention policy. Netlify usage/billing limits also apply; this work does not promise unlimited or free storage.

## Verification

- TypeScript checks and production frontend build.
- Six passing automated tests covering cookie verification, expiry, cross-origin rejection, invalid/valid login, CSV escaping, date handling, monthly deduplication, insight percentages and offline retry behavior.
- Browser verification of overview rendering, search, manual attendance updates, persistence after reload, mobile width/navigation, settings and monthly reports. Confirmed that late arrivals appear separately and the insight percentage matches the monthly breakdown.
- Actual cloud authentication and new protected data endpoints still require post-deployment verification after Netlify access is restored.

Design reference: https://linear.app/docs/dashboards
Storage reference: https://docs.netlify.com/build/data-and-storage/netlify-blobs/
