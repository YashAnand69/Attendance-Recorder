# Attendly — Fast, private classroom attendance

## Fresh Vercel deployment

The Vercel target uses protected Vercel Functions and a fresh private Blob store, with no Netlify data migration. See [the Vercel database guide](docs/VERCEL-DATABASE.md). The Netlify configuration remains available as a separate hosting adapter.

## Version 2 workspace

The redesign adds a responsive sidebar, attendance overview, separate demo mode, protected cloud access, persistent offline mutations, and storage/backup controls. Read [the upgrade and database guide](docs/DATABASE-AND-UPGRADE.md) for architecture, privacy behavior, verification and current limitations.

Production requires server-only `ATTENDLY_PASSWORD_HASH` and `ATTENDLY_SESSION_SECRET` environment variables. Without them the public demo works, but administrator login is unavailable. The previous hardcoded frontend password is no longer used.

Run `npm run lint`, `npm test` and `npm run build:web` before deployment. Use `npx netlify dev` for local cloud-function development; plain Vite previews run the demo.

Attendly is an offline-first attendance workspace for classroom check-in. It includes:

- On-device face detection and 128-dimension face matching using bundled models.
- Camera check-in with a classroom geofence check; uploaded photos are comparison tests only and do not record attendance.
- Deterministic one-record-per-student-per-day attendance writes.
- Persistent Netlify Blobs storage with a local cache and offline queue.
- Admin-gated dashboard, roster enrollment, CSV/PDF exports, and local attendance insights.
- Optional Netlify Functions for Gemini analysis and Resend parent email alerts.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The app is usable in local mode even when the remote data API is unavailable. Camera access requires a secure origin (`https://` or localhost).

## Optional environment variables

Create a local `.env` only when you want the optional server features:

```bash
GEMINI_API_KEY=your_gemini_key
RESEND_API_KEY=your_resend_key
ATTENDANCE_FROM_EMAIL=Attendance <attendance@example.com>
```

For Netlify, add these values in Site configuration → Environment variables. Never commit `.env` or provider keys.

## Build and deploy

```bash
npm run build:web
```

Netlify uses `netlify.toml`, publishes `dist`, caches the face model assets, and rewrites the SPA routes. The default site is `https://attendly-attendance.netlify.app`.

## Data storage

The deployed app stores persistent records in a site-scoped Netlify Blobs store named `attendly-attendance`, accessed through `/api/attendance-data`. It keeps separate keys for `students`, `classrooms`, `attendance_logs`, and `parent_alerts`. When a device is offline, the browser uses local storage and syncs queued changes when connectivity returns.

## Privacy note

Face descriptors are computed in the browser. Camera frames are not sent to Gemini by the default scanner flow. Enroll only people who have provided the appropriate consent for biometric attendance use, and configure storage retention and access for your institution's policy.
