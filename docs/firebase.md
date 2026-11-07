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
The starter security rules enforce:
1. Public read for matches and rooms so users can discover rooms by room code.
2. Authenticated write permissions only.
3. Players can only modify their own player node (`auth.uid == $uid`).
4. Attacks can only be submitted if `from == auth.uid`.
