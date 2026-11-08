import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  onValue,
  off,
  push,
  onDisconnect,
  runTransaction,
  Database
} from 'firebase/database';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'nint-demo.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://nint-demo-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'nint-demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'nint-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef123456'
};

export interface RemotePlayerState {
  displayName: string;
  userId?: string;
  rating?: number;
  ready: boolean;
  score: number;
  lines: number;
  alive: boolean;
  connected?: boolean;
  board?: string; // serialized JSON array
  activePiece?: {
    type: string;
    x: number;
    y: number;
    rotation: number;
  } | null;
  holdPiece?: string | null;
  queue?: string[];
  clearingRows?: number[];
  lastSeen: number;
}

export class FirebaseRealtimeService {
  private static app: FirebaseApp | null = null;
  private static db: Database | null = null;
  private static auth: Auth | null = null;
  private static currentUid: string = '';
  private static isConfigured: boolean = false;

  public static initialize(): boolean {
    if (this.app) return this.isConfigured;

    try {
      const isDemoConfig = !import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY === 'demo-api-key';
      if (!isDemoConfig) {
        this.app = initializeApp(firebaseConfig);
        this.db = getDatabase(this.app);
        this.auth = getAuth(this.app);
        this.isConfigured = true;
      } else {
        this.isConfigured = false;
      }
    } catch (e) {
      console.warn('Firebase initialization notice:', e);
      this.isConfigured = false;
    }

    if (!this.currentUid) {
      this.currentUid = 'player_' + Math.random().toString(36).substring(2, 9);
    }
    return this.isConfigured;
  }

  public static getUid(): string {
    return this.auth?.currentUser?.uid || this.currentUid;
  }

  public static async authenticate(displayName: string = 'Player'): Promise<string> {
    this.initialize();
    if (this.isConfigured && this.auth) {
      try {
        if (this.auth.currentUser) {
          this.currentUid = this.auth.currentUser.uid;
          return this.currentUid;
        }
        const cred = await signInAnonymously(this.auth);
        this.currentUid = cred.user.uid;
        return this.currentUid;
      } catch (e) {
        console.warn('Anonymous auth failed, falling back to local UID:', e);
      }
    }
    return this.currentUid;
  }

  // Create an online room
  public static async createRoom(roomCode: string, displayName: string, rating: number = 1000, userId?: string): Promise<{ matchId: string; seed: number }> {
    const matchId = 'match_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const uid = this.getUid();
    const seed = Math.floor(Math.random() * 1000000);

    if (this.isConfigured && this.db) {
      // Setup room entry
      const roomRef = ref(this.db, `rooms/${roomCode}`);
      await set(roomRef, {
        matchId,
        hostUid: uid,
        status: 'waiting',
        createdAt: Date.now()
      });

      // Clear room on disconnect
      onDisconnect(roomRef).remove().catch(() => {});

      // Setup match entry
      const matchRef = ref(this.db, `matches/${matchId}`);
      await set(matchRef, {
        matchId,
        roomCode,
        seed,
        status: 'waiting',
        createdAt: Date.now(),
        players: {
          [uid]: {
            displayName,
            userId: userId || null,
            rating: rating || 1000,
            ready: true,
            score: 0,
            lines: 0,
            alive: true,
            connected: true,
            lastSeen: Date.now()
          }
        }
      });

      // On host disconnect, mark as left
      const hostPlayerRef = ref(this.db, `matches/${matchId}/players/${uid}`);
      onDisconnect(hostPlayerRef).update({
        connected: false,
        alive: false,
        lastSeen: Date.now()
      }).catch(() => {});
    }

    return { matchId, seed };
  }

  // Join an online room
  public static async joinRoom(roomCode: string, displayName: string, rating: number = 1000, userId?: string): Promise<{ matchId: string; seed: number }> {
    const uid = this.getUid();

    if (!this.isConfigured || !this.db) {
      throw new Error('Firebase is not configured. Please check your .env settings.');
    }

    const roomRef = ref(this.db, `rooms/${roomCode}`);
    const snapshot = await get(roomRef);
    if (!snapshot.exists()) {
      throw new Error(`Room "${roomCode}" not found. Verify the code.`);
    }

    const roomData = snapshot.val();
    const matchId = roomData.matchId;

    const matchSnap = await get(ref(this.db, `matches/${matchId}`));
    if (!matchSnap.exists()) {
      throw new Error('Match expired or no longer available.');
    }

    const matchData = matchSnap.val();

    // Register second player
    const playerRef = ref(this.db, `matches/${matchId}/players/${uid}`);
    await set(playerRef, {
      displayName,
      userId: userId || null,
      rating: rating || 1000,
      ready: true,
      score: 0,
      lines: 0,
      alive: true,
      connected: true,
      lastSeen: Date.now()
    });

    // On guest disconnect, mark as left
    onDisconnect(playerRef).update({
      connected: false,
      alive: false,
      lastSeen: Date.now()
    }).catch(() => {});

    // Mark room and match status as active
    await update(ref(this.db, `matches/${matchId}`), {
      status: 'active',
      startedAt: Date.now()
    });

    await update(roomRef, {
      status: 'active'
    });

    return { matchId, seed: matchData.seed || 12345 };
  }

  // Listen for match status once (triggered only on status change)
  public static listenToMatchStart(matchId: string, onStart: (matchData: any) => void): () => void {
    if (!this.isConfigured || !this.db) {
      return () => {};
    }

    const statusRef = ref(this.db, `matches/${matchId}/status`);
    let hasStarted = false;

    const listener = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const status = snapshot.val();
        if (status === 'active' && !hasStarted) {
          hasStarted = true;
          // Fetch full match data once to get opponent info
          get(ref(this.db!, `matches/${matchId}`)).then((snap) => {
            if (snap.exists()) {
              onStart(snap.val());
            }
          });
        }
      }
    });

    return () => off(statusRef, 'value', listener);
  }

  // Send garbage attack event
  public static async sendAttack(matchId: string, amount: number) {
    if (this.isConfigured && this.db) {
      const attacksRef = ref(this.db, `matches/${matchId}/attacks`);
      await push(attacksRef, {
        from: this.getUid(),
        amount,
        timestamp: Date.now()
      });
    }
  }

  // Listen for opponent attacks
  public static listenToAttacks(matchId: string, onAttackReceived: (amount: number) => void): () => void {
    if (!this.isConfigured || !this.db) {
      return () => {};
    }

    const uid = this.getUid();
    const attacksRef = ref(this.db, `matches/${matchId}/attacks`);

    const listener = onValue(attacksRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const keys = Object.keys(val);
        const lastKey = keys[keys.length - 1];
        const lastAttack = val[lastKey];
        if (lastAttack && lastAttack.from !== uid) {
          onAttackReceived(lastAttack.amount);
        }
      }
    });

    return () => off(attacksRef, 'value', listener);
  }

  // Update live player state (score, lines, board, queue, hold, alive, connected)
  public static async updateState(matchId: string, data: Partial<RemotePlayerState>) {
    if (this.isConfigured && this.db) {
      const uid = this.getUid();
      const playerRef = ref(this.db, `matches/${matchId}/players/${uid}`);
      await update(playerRef, {
        ...data,
        lastSeen: Date.now()
      });
    }
  }

  // Listen to remote opponent state
  public static listenToOpponent(matchId: string, onOpponentUpdate: (opponent: RemotePlayerState) => void): () => void {
    if (!this.isConfigured || !this.db) {
      return () => {};
    }

    const uid = this.getUid();
    const playersRef = ref(this.db, `matches/${matchId}/players`);

    const listener = onValue(playersRef, (snapshot) => {
      if (snapshot.exists()) {
        const players = snapshot.val();
        for (const [pUid, pState] of Object.entries<any>(players)) {
          if (pUid !== uid) {
            onOpponentUpdate(pState);
            break;
          }
        }
      }
    });

    return () => off(playersRef, 'value', listener);
  }

  // Register onDisconnect for current player on a match
  public static registerDisconnect(matchId: string) {
    if (this.isConfigured && this.db) {
      const uid = this.getUid();
      const playerRef = ref(this.db, `matches/${matchId}/players/${uid}`);
      onDisconnect(playerRef).update({
        connected: false,
        alive: false,
        lastSeen: Date.now()
      }).catch(() => {});
    }
  }

  // Request rematch after a finished match
  public static async requestRematch(matchId: string) {
    if (this.isConfigured && this.db) {
      const uid = this.getUid();
      const rematchRef = ref(this.db, `matches/${matchId}/rematch/${uid}`);
      await set(rematchRef, true);
    }
  }

  // Listen to rematch decisions
  public static listenToRematch(matchId: string, onUpdate: (rematchData: { [uid: string]: boolean }) => void): () => void {
    if (!this.isConfigured || !this.db) {
      return () => {};
    }

    const rematchRef = ref(this.db, `matches/${matchId}/rematch`);
    const listener = onValue(rematchRef, (snapshot) => {
      const val = snapshot.exists() ? snapshot.val() : {};
      onUpdate(val);
    });

    return () => off(rematchRef, 'value', listener);
  }

  // Trigger next match in the same room when both players agreed
  public static async createNextMatch(
    currentMatchId: string,
    roomCode: string
  ): Promise<{ nextMatchId: string; seed: number }> {
    const nextMatchId = 'match_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const seed = Math.floor(Math.random() * 1000000);

    if (this.isConfigured && this.db) {
      // 1. Fetch previous players to carry over display names and reset stats
      const currentSnap = await get(ref(this.db, `matches/${currentMatchId}`));
      const currentData = currentSnap.exists() ? currentSnap.val() : {};
      const previousPlayers = currentData.players || {};

      const freshPlayers: any = {};
      for (const [uid, p] of Object.entries<any>(previousPlayers)) {
        freshPlayers[uid] = {
          displayName: p.displayName || 'Player',
          ready: true,
          score: 0,
          lines: 0,
          alive: true,
          connected: true,
          lastSeen: Date.now()
        };
      }

      // 2. Create the next match document
      await set(ref(this.db, `matches/${nextMatchId}`), {
        matchId: nextMatchId,
        roomCode,
        seed,
        status: 'active',
        createdAt: Date.now(),
        players: freshPlayers
      });

      // 3. Setup host onDisconnect on the new match
      const myUid = this.getUid();
      const myPlayerRef = ref(this.db, `matches/${nextMatchId}/players/${myUid}`);
      onDisconnect(myPlayerRef).update({
        connected: false,
        alive: false,
        lastSeen: Date.now()
      }).catch(() => {});

      // 4. Update room to point to the new match
      await update(ref(this.db, `rooms/${roomCode}`), {
        matchId: nextMatchId,
        status: 'active'
      });

      // 5. Notify both participants through the previous match
      await set(ref(this.db, `matches/${currentMatchId}/nextMatch`), {
        nextMatchId,
        seed
      });
    }

    return { nextMatchId, seed };
  }

  // Listen to next match trigger
  public static listenToNextMatch(matchId: string, onNextMatch: (data: { nextMatchId: string; seed: number }) => void): () => void {
    if (!this.isConfigured || !this.db) {
      return () => {};
    }

    const nextMatchRef = ref(this.db, `matches/${matchId}/nextMatch`);
    let triggered = false;
    const listener = onValue(nextMatchRef, (snapshot) => {
      if (snapshot.exists() && !triggered) {
        triggered = true;
        onNextMatch(snapshot.val());
      }
    });

    return () => off(nextMatchRef, 'value', listener);
  }

  // Quick Search Matchmaking:
  // Strictly compliant with database.rules.json (uses /matchmaking_queue/$uid)
  // 1. Checks if another player is already waiting in matchmaking_queue and joins their room.
  // 2. If nobody is waiting, registers this player under matchmaking_queue/$uid and awaits an opponent.
  // 3. Periodically checks if another room was created simultaneously and resolves ties deterministically.
  public static async startQuickMatch(
    displayName: string,
    onMatched: (role: 'host' | 'guest', seed: number, matchId: string, roomCode: string) => void,
    rating: number = 1000,
    userId?: string
  ): Promise<() => Promise<void>> {
    await this.authenticate(displayName);
    const uid = this.getUid();

    if (!this.isConfigured || !this.db) {
      throw new Error('Firebase is not configured. Please check your network or configuration.');
    }

    let isDisposed = false;
    let matchFound = false;
    let unsubscribeStart: (() => void) | null = null;
    let pollTimer: any = null;

    const myQueueRef = ref(this.db, `matchmaking_queue/${uid}`);
    const queueListRef = ref(this.db, 'matchmaking_queue');

    // Helper: attempt to join an existing waiting player's room
    const tryJoinExisting = async (): Promise<boolean> => {
      try {
        const snap = await get(queueListRef);
        if (!snap.exists()) return false;

        const queue = snap.val();
        const now = Date.now();

        for (const [otherUid, entry] of Object.entries<any>(queue)) {
          if (otherUid !== uid && entry && entry.roomCode && (now - (entry.createdAt || 0) < 60000)) {
            // Verify the room is still waiting
            const roomSnap = await get(ref(this.db!, `rooms/${entry.roomCode}`));
            if (roomSnap.exists() && roomSnap.val().status === 'waiting') {
              matchFound = true;
              isDisposed = true;

              if (pollTimer) clearInterval(pollTimer);
              if (unsubscribeStart) unsubscribeStart();

              // Remove our own queue entry if we had one
              set(myQueueRef, null).catch(() => {});

              const { matchId, seed } = await this.joinRoom(entry.roomCode, displayName, rating, userId);
              onMatched('guest', seed, matchId, entry.roomCode);
              return true;
            }
          }
        }
      } catch (e) {
        console.warn('Error checking existing quick match rooms:', e);
      }
      return false;
    };

    // Step 1: Check if an opponent is already waiting
    const joined = await tryJoinExisting();
    if (joined) {
      return async () => {};
    }

    // Step 2: Nobody is waiting yet, so we become the host
    const myCreatedAt = Date.now();
    const roomCode = 'Q' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const { matchId, seed } = await this.createRoom(roomCode, displayName, rating, userId);

    if (isDisposed) {
      // User cancelled during room creation
      this.leaveRoom(roomCode, matchId).catch(() => {});
      return async () => {};
    }

    // Publish our room under matchmaking_queue/$uid (allowed by auth.uid == $uid)
    await set(myQueueRef, {
      uid,
      displayName,
      userId: userId || null,
      rating: rating || 1000,
      roomCode,
      matchId,
      seed,
      createdAt: myCreatedAt
    });

    // Automatically remove our entry if we disconnect
    onDisconnect(myQueueRef).remove().catch(() => {});

    // Listen for opponent joining our room
    unsubscribeStart = this.listenToMatchStart(matchId, () => {
      if (matchFound) return;
      matchFound = true;
      isDisposed = true;

      if (pollTimer) clearInterval(pollTimer);
      // Clean up our own queue entry (allowed by auth.uid == $uid)
      set(myQueueRef, null).catch(() => {});
      onMatched('host', seed, matchId, roomCode);
    });

    // Step 3: Every 1.5s, check if an older room exists (tie-breaking in case 2 players hosted simultaneously)
    pollTimer = setInterval(async () => {
      if (isDisposed || matchFound) {
        if (pollTimer) clearInterval(pollTimer);
        return;
      }

      try {
        const snap = await get(queueListRef);
        if (!snap.exists()) return;

        const queue = snap.val();
        const now = Date.now();

        for (const [otherUid, entry] of Object.entries<any>(queue)) {
          if (otherUid !== uid && entry && entry.roomCode && (now - (entry.createdAt || 0) < 60000)) {
            const otherCreated = entry.createdAt || 0;
            // Deterministic tie-breaker: if other room is older, or created at same ms and has lower UID:
            const otherHasPrecedence = otherCreated < myCreatedAt || (otherCreated === myCreatedAt && otherUid < uid);

            if (otherHasPrecedence) {
              const roomSnap = await get(ref(this.db!, `rooms/${entry.roomCode}`));
              if (roomSnap.exists() && roomSnap.val().status === 'waiting') {
                matchFound = true;
                isDisposed = true;
                if (pollTimer) clearInterval(pollTimer);
                if (unsubscribeStart) unsubscribeStart();

                // Clean up our own room and queue entry
                set(myQueueRef, null).catch(() => {});
                this.leaveRoom(roomCode, matchId).catch(() => {});

                // Join the older room
                const res = await this.joinRoom(entry.roomCode, displayName, rating, userId);
                onMatched('guest', res.seed, res.matchId, entry.roomCode);
                return;
              }
            }
          }
        }
      } catch (e) {
        console.warn('Tie-break check notice:', e);
      }
    }, 1500);

    // Cancel search callback
    return async () => {
      isDisposed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (unsubscribeStart) unsubscribeStart();
      try {
        await set(myQueueRef, null);
        await this.leaveRoom(roomCode, matchId);
      } catch (e) {
        console.warn('Error cancelling quick search:', e);
      }
    };
  }

  // Clean room when leaving
  public static async leaveRoom(roomCode: string, matchId: string) {
    if (this.isConfigured && this.db) {
      try {
        const uid = this.getUid();
        if (matchId) {
          // Explicitly mark player as disconnected so remaining opponent gets victory
          const playerRef = ref(this.db, `matches/${matchId}/players/${uid}`);
          await update(playerRef, {
            connected: false,
            alive: false,
            lastSeen: Date.now()
          });
        }
        if (roomCode) {
          await set(ref(this.db, `rooms/${roomCode}`), null);
        }
      } catch (e) {
        console.warn('Error cleaning up room:', e);
      }
    }
  }
}
