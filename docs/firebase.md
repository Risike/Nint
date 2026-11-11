# Firebase Realtime Database Architecture

Nint uses Firebase Realtime Database for fast, peer-to-peer multiplayer synchronization without requiring custom WebSockets server hosting.

## Data Structure

```json
{
  "matches": {
    "<matchId>": {
      "matchId": "match_1700000000000",
      "seed": 987654,
      "status": "waiting | active | finished",
      "createdAt": 1700000000000,
      "startedAt": 1700000005000,
      "players": {
        "<uid>": {
          "displayName": "Player 1",
          "ready": true,
          "score": 12000,
          "lines": 28,
          "alive": true,
          "lastSeen": 1700000030000
        }
      },
      "attacks": {
        "<attackId>": {
          "from": "<uid>",
          "amount": 4,
          "timestamp": 1700000025000
        }
      },
      "rematch": {
        "<uid>": true
      }
    }
  },
  "rooms": {
    "<roomCode>": {
      "matchId": "match_1700000000000",
      "hostUid": "<uid>",
      "status": "waiting | in_game | finished",
      "createdAt": 1700000000000
    }
  }
}
```

## Security Rules (`firebase/database.rules.json`)
The security rules enforce:
1. Authenticated read access to matches and rooms (guest play is blocked in the UI anyway).
2. Match documents can only be created whole; after creation, only the `status`, `startedAt` and `nextMatch` children are writable. Seeds and player lists cannot be replaced.
3. Rooms can only be created by their host, and only the host (`hostUid == auth.uid`) can update or delete them.
4. Players can only modify their own player node (`auth.uid == $uid`), with validation on display name, rating, board size and boolean flags.
5. Attacks can only be submitted if `from == auth.uid`, and the amount is validated between 0 and 20 lines.
6. Matchmaking queue entries can only be written by their owner. Each room, match and queue entry carries a `ranked` boolean, so ranked and casual players never match each other.

## Local Firebase Emulator

`npm run dev` starts the Auth and Realtime Database emulators, waits for them, and then launches the API and Vite:

- Emulator UI: `http://127.0.0.1:4000`
- Auth emulator: `127.0.0.1:9099`
- Realtime Database emulator: `127.0.0.1:9000`

The frontend connects to the emulator automatically in development when the demo Firebase config is used. The emulator loads `firebase/database.rules.json`, so the hardened rules are exercised locally. Run `npm run emulators` to start only the emulators. Java 11+ is required for the Realtime Database emulator; the first run downloads its JAR.
