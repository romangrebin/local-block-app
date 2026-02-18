# Agent Guardrails

This project has security-sensitive defaults. Any coding agent (Codex, Cursor, Claude Code, etc.) should preserve these constraints unless explicitly asked to change them.

## Do Not Regress
- Keep Firestore `communities` read/list policy unchanged unless requested.
- Do not reintroduce public `memberContent` on `communities/{code}` documents.
- Keep member-only content in `communities/{code}/private/memberContent`.
- Keep Firestore size/schema guards in `firestore.rules`.
- Keep App Check integration in `src/data/firebase.ts`.
- Keep CSP hosts required for Firebase/Auth/Firestore/App Check/reCAPTCHA.
- Keep crawler blocking (`X-Robots-Tag` and `public/robots.txt`).

## Required Checks Before Merge/Deploy
- Run `npm run security:check`.
- Run `npm run build`.
- If editing `firebase.json`, verify CSP still contains:
  - `https://content-firebaseappcheck.googleapis.com`
  - `https://firebase.googleapis.com`
  - `https://firestore.googleapis.com`
  - `https://www.googletagmanager.com`

## Notes
- App Check debug tokens are local-only. Never add debug tokens to CI/prod env.
- Keep `VITE_FIREBASE_APPCHECK_SITE_KEY` wired in deploy workflow.
