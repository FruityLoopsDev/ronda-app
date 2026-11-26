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

The Firebase Web App `RONDA Staging` is registered in the `ronda-staging-2026` project. Its public Firebase Web SDK configuration is embedded in `src/firebase-config.ts`.

The web config values are client-side configuration, not service-account credentials. Never place service-account JSON, private keys, or Admin SDK credentials in Vite variables or browser code.

To opt into staging, build with the explicit project ID:

```bash
npm ci
VITE_FIREBASE_PROJECT_ID=ronda-staging-2026 npm run build -- --mode staging
```

For local development, set `VITE_FIREBASE_PROJECT_ID=ronda-staging-2026` in `.env.staging`. Do not set this variable for production builds.

## Fail-closed behavior

- When `VITE_FIREBASE_PROJECT_ID=ronda-staging-2026`, the app initializes only the dedicated staging project configuration.
- If the variable is absent, the existing production configuration remains unchanged.
- An unrecognized project ID is rejected.
- Staging selection is explicit; it is never inferred from the Vite mode name alone.

## Build and deploy

After reviewing Authentication providers, Firestore rules, and indexes in Firebase Console:

```bash
npm ci
VITE_FIREBASE_PROJECT_ID=ronda-staging-2026 npm run build -- --mode staging
firebase deploy --only hosting,firestore:rules,firestore:indexes --project ronda-staging-2026
```

Do not run a deploy until the project ID displayed in Firebase Console has been checked against `ronda-staging-2026`, and the staging Firestore rules have been reviewed. The command above targets Firebase Hosting and Firestore only.

## Firebase Console setup checklist

1. Confirm the Firebase Web App `RONDA Staging` exists in project `ronda-staging-2026`.
2. Enable only the Authentication sign-in providers required by the pilot.
3. Create the default Firestore database in the staging project.
4. Review `firestore.rules` and `firestore.indexes.json` before deploying them.
5. Confirm the project ID in the console is exactly `ronda-staging-2026`.
6. Use only synthetic test accounts and records.
