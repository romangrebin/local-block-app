# Firebase Integration Plan (MVP)

## Goal
Move the MVP from local JSON to Firebase Auth + Firestore while keeping the UI and data abstractions easy to swap later.

## High-level Phases
1. **Project + Auth**: Create Firebase project, add web app, enable Email/Password sign-in.
2. **Database**: Create Firestore database, add rules for public reads + admin writes.
3. **Frontend Wiring**: Use Firebase SDK in the app with environment variables.
4. **Local Dev**: Optional emulators for Auth + Firestore.
5. **Hosting**: Use Firebase Hosting for production builds.

## Local Setup
1. Create a Firebase project in the Firebase console.
2. Add a Web App to the project and copy the config values.
3. Enable Email/Password under Authentication.
4. Create a Firestore database.
5. Copy `firestore.rules` into the Firebase console rules editor (or deploy with the CLI later).
6. Create `.env.local` from `.env.example` and paste your Firebase config values.

Example `.env.local`:
```
VITE_USE_FIREBASE_EMULATORS=false
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

## Optional: Emulators
1. Install the Firebase CLI.
2. Run `firebase init emulators` and enable Auth + Firestore.
3. Start with `firebase emulators:start`.
4. Set `VITE_USE_FIREBASE_EMULATORS=true`.

## Seed Demo Communities
1. Create a Firebase service account JSON and store it locally (not in git).
   - Suggested path: `.secrets/firebase-service-account.json`
   - This is required for admin access; your client `.env.local` values are not sufficient.
2. Run:
   ```
   npm run seed:firebase
   ```
   This reads `src/data/db.json` and upserts communities into Firestore.

## Privacy & Discovery
- Firestore rules block list queries so communities cannot be enumerated.
- Make sure you deploy the latest `firestore.rules` after updating.

## Migrate Member-Only Content (Public -> Private Path)
Member-only content now lives at:
`communities/{code}/private/memberContent`

Run the migration in two steps:
1. Dry run:
   ```
   npm run migrate:member-content
   ```
2. Copy legacy values into the private path:
   ```
   npm run migrate:member-content -- --apply
   ```
3. After validating member reads/writes in the app, remove the old public field:
   ```
   npm run migrate:member-content -- --apply --remove-public
   ```

You can test a single community first with:
```
npm run migrate:member-content -- --code=my-community-code
```

## Hosting (Production)
1. Run `npm run build`.
2. Run `firebase init hosting`.
3. Deploy with `firebase deploy`.
4. Confirm Hosting headers are active (from `firebase.json`) after deploy.


## GitHub Actions (Manual Deploy)
1. Add repo secrets for the build:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`
2. Add a service account JSON as the secret `FIREBASE_SERVICE_ACCOUNT`.
3. The workflow `Deploy to Firebase Hosting (Manual)` can be run from the Actions tab.

## Secrets & Open Source
- The Firebase web config is *not* a secret, but should still live in `.env.local` to keep config out of source control.
- `.env.local` is gitignored. Share `.env.example` in the repo.
- If you use CI/CD, store the env values in the CI secrets manager and inject at build time.
