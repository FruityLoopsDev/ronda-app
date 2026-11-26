# Firebase staging — RONDA

Firebase staging project ID: `ronda-staging-2026`

## Safety rules

- Production remains `ronda-uno`; do not change the default `.firebaserc` project.
- Never deploy staging with an implicit/default Firebase project.
- Every staging deploy must pass `--project ronda-staging-2026` explicitly.
- Do not use production users, reservations, payment data, or personal data in staging.
- Keep biometric verification paused during the first-reservation pilot.
- Do not deploy until Authentication providers, Firestore rules, and indexes have been reviewed in the staging project.

## Web app configuration

Register a Firebase Web App named `RONDA Staging` inside the `ronda-staging-2026` project. Supply its Firebase Web App config through a local `.env.staging` file or the equivalent environment variables in a trusted Firebase build pipeline:

```dotenv
VITE_FIREBASE_PROJECT_ID=ronda-staging-2026
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_USE_FIREBASE_EMULATOR=false
```

The web config values are Firebase client configuration, not service-account credentials. Never place service-account JSON, private keys, or admin SDK credentials in Vite variables or browser code.

## Fail-closed behavior

When `VITE_FIREBASE_PROJECT_ID=ronda-staging-2026`, the app requires the complete staging web config. If any required value is missing, startup fails rather than silently falling back to `ronda-uno`.

If no staging project ID is supplied, the existing production configuration remains unchanged. An unrecognized project ID is rejected.

## Build and deploy

After adding the real web app config to `.env.staging`:

```bash
npm ci
npm run build -- --mode staging
firebase deploy --only hosting,firestore:rules,firestore:indexes --project ronda-staging-2026
```

Do not run a deploy until the project ID displayed in Firebase Console has been checked against `ronda-staging-2026`, and the staging Firestore rules have been reviewed. The command above targets Firebase Hosting and Firestore only.

## Firebase Console setup checklist

1. Register the Firebase Web App `RONDA Staging`.
2. Enable only the Authentication sign-in providers required by the pilot.
3. Create the default Firestore database in the staging project.
4. Review `firestore.rules` and `firestore.indexes.json` before deploying them.
5. Confirm the project ID in the console is exactly `ronda-staging-2026`.
6. Use only synthetic test accounts and records.
