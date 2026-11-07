# Firebase Realtime Database Setup for Nint

Nint uses Firebase Realtime Database for fast, low-latency 1v1 online matchmaking and peer-to-peer game state synchronization.

## Setup Steps

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/).
2. Enable **Realtime Database** in test or locked mode (select a location closest to your users, e.g. `us-central1` or `europe-west1`).
3. Enable **Authentication** with:
   - **Anonymous** provider (for instant guest 1v1 play).
   - Or **Email/Password** provider.
4. Copy `firebase/database.rules.json` into your Firebase Realtime Database Rules tab and click **Publish**.
5. In Project Settings -> General -> Your apps, create a Web App and copy the config values into `.env` (or environment variables):
   ```bash
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_DATABASE_URL=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

## Local Development with Firebase Emulator

To run with Firebase local emulator:
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Run `firebase emulators:start --only database,auth`
3. Set `VITE_USE_FIREBASE_EMULATOR=true` in `.env`.
