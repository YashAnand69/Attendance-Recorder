# Fresh Vercel workspace

Prepared 27 September 2026. This document supersedes the Netlify-specific hosting and storage details in DATABASE-AND-UPGRADE.md for the Vercel deployment.

## Hosting and storage

- Vercel project: attendly-attendance, team yash (yash-56e6).
- New private Vercel Blob store: attendly-records, ID store_yz8bOib2ufIg7zQW.
- Storage and API region: Mumbai (bom1). Frontend assets use Vercel's delivery network.
- This is JSON document/object storage, not a relational SQL database.
- No Netlify records were copied, changed or deleted. The new workspace starts empty.
- The separate Oracle SQL module is still not connected to the website.

## Stored information

The store holds students/<id>, classrooms/<id>, attendance_logs/att-YYYY-MM-DD-<student-id>, and parent_alerts/<id>.

Student documents include name, roll number, class, guardian contact details and enrollment photo. Classroom documents hold the location/radius. Attendance contains student/date/status/method/score and coordinates when present. New check-in snapshots are stripped before server storage. Face matching remains in the browser; enrollment photos are stored in the private store and browser cache.

## Access and saving

Vercel Functions implement /api/session and /api/attendance-data. A server-verified administrator password issues a 12-hour HttpOnly, Secure, SameSite=Strict cookie. The server checks login and request origin before mutations. The password hash and signing secret are server-only production secrets. The plain password is only in a private local handoff file.

Functions access Blob through project-scoped OIDC, using short-lived credentials. No long-lived Blob token was installed, and no storage credentials are sent to the frontend. All stored blobs use private access. Reads bypass the Blob CDN cache to retrieve current content. API responses use private, no-store caching.

Edits update locally and enter a browser queue until acknowledged by the server. A stable student/date key prevents duplicate daily attendance entries. While visible, the app refreshes every 20 seconds. Simultaneous writes use last accepted write wins; there are no cross-document transactions or server-enforced unique roll numbers.

The demo stays separate and never writes to the cloud. Browser localStorage caches are not encrypted. They are scoped to the Vercel website's origin and do not automatically import Netlify or localhost data. Signing out clears the main cloud cache but retains pending mutations to avoid data loss.

## Backups, deletion and limitations

Use Settings → Download backup to save a JSON copy. Store it securely: it contains personal information and enrollment photos. There is no scheduled backup, point-in-time restore, import UI or retention job in this version. Deleting a student profile does not remove historical attendance or alert records.

The API currently loads complete collections, with paginated Blob listing underneath. Large rosters and frequent refreshes increase storage operations and transfer usage. Vercel Hobby limits apply; no paid-plan upgrade was performed. This remains a single-administrator classroom app, not a multi-school access-control system.

Face matching has no liveness/anti-spoofing protection and needs consenting-participant accuracy testing. GPS can be spoofed. Manual attendance correction is available.

Parent email and Gemini insights are optional and not configured on this fresh project. Local insights and exports work without those services; no emails were sent during deployment verification.

## Deployment verification

Production: https://attendly-attendance.vercel.app/

Deployment dpl_FzpFo4UukYDMwD23joXAVFmJ4fkY reached READY and was promoted to production. Seven local automated tests and TypeScript checks passed.

Live checks passed: correct/incorrect login, signed session, rejection of anonymous reads, private storage reads, student enrollment write/read, attendance write/read/update, daily-key deduplication, server snapshot stripping and cross-origin rejection. The temporary test student and attendance record were deleted; the cloud workspace was verified empty again. No existing user data was deleted.

The public page, session endpoint and recognition model asset respond successfully. The error-log scan returned no entries at verification time; no dedicated alerting/log drain was added. Optional email/AI providers and real-camera recognition accuracy were not end-to-end tested.

References: [Vercel private storage](https://vercel.com/docs/vercel-blob/private-storage), [consistent private reads](https://vercel.com/changelog/vercel-blob-now-supports-consistent-reads-on-private-storage).
