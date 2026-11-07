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
  serverTimestamp,
  onDisconnect,
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
  ready: boolean;
  score: number;
  lines: number;
  alive: boolean;
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
      console.warn('Firebase initialization notice (running in local simulation mode):', e);
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
  public static async createRoom(roomCode: string, displayName: string): Promise<string> {
    const matchId = 'match_' + Date.now();
    const uid = this.getUid();

    if (this.isConfigured && this.db) {
      const roomRef = ref(this.db, `rooms/${roomCode}`);
      await set(roomRef, {
        matchId,
        hostUid: uid,
        status: 'waiting',
        createdAt: Date.now()
      });

      const matchRef = ref(this.db, `matches/${matchId}`);
      await set(matchRef, {
        matchId,
        seed: Math.floor(Math.random() * 1000000),
        status: 'waiting',
        createdAt: Date.now(),
        players: {
          [uid]: {
            displayName,
            ready: true,
            score: 0,
            lines: 0,
            alive: true,
            lastSeen: Date.now()
          }
        }
      });
    }

    return matchId;
  }

  // Join an online room
  public static async joinRoom(roomCode: string, displayName: string): Promise<{ matchId: string; seed: number }> {
    const uid = this.getUid();

    if (this.isConfigured && this.db) {
      const roomRef = ref(this.db, `rooms/${roomCode}`);
      const snapshot = await get(roomRef);
      if (!snapshot.exists()) {
        throw new Error('Room not found. Check the code and try again.');
      }
      const roomData = snapshot.val();
      const matchId = roomData.matchId;

      const playerRef = ref(this.db, `matches/${matchId}/players/${uid}`);
      await set(playerRef, {
        displayName,
        ready: true,
        score: 0,
        lines: 0,
        alive: true,
        lastSeen: Date.now()
      });

      // Update room to active
      await update(ref(this.db, `matches/${matchId}`), {
        status: 'active',
        startedAt: Date.now()
      });

      const matchSnap = await get(ref(this.db, `matches/${matchId}`));
      const matchData = matchSnap.val();

      return { matchId, seed: matchData.seed || 12345 };
    }

    // Local simulation fallback for testing room join
    return { matchId: 'sim_' + roomCode, seed: 12345 };
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

  // Update live player state (score, lines, alive)
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

  // Request rematch
  public static async requestRematch(matchId: string) {
    if (this.isConfigured && this.db) {
      const uid = this.getUid();
      const rematchRef = ref(this.db, `matches/${matchId}/rematch/${uid}`);
      await set(rematchRef, true);
    }
  }
}
