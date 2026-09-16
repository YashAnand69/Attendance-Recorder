# Attendly — Fast, private classroom attendance

Attendly is an offline-first attendance workspace for classroom check-in. It includes:

- On-device face detection and 128-dimension face matching using bundled models.
- Camera and upload-based verification with a classroom geofence check.
- Deterministic one-record-per-student-per-day attendance writes.
- Local cache and offline queue with Firestore real-time sync when available.
- Admin-gated dashboard, roster enrollment, CSV/PDF exports, and local attendance insights.
- Optional Netlify Functions for Gemini analysis and Resend parent email alerts.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The app is usable in local mode even when Firebase is unavailable. Camera access requires a secure origin (`https://` or localhost).

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

## Privacy note

Face descriptors are computed in the browser. Camera frames are not sent to Gemini by the default scanner flow. Enroll only people who have provided the appropriate consent for biometric attendance use, and configure Firestore rules and retention to match your institution's policy.
