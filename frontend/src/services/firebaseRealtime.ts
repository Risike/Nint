import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  connectDatabaseEmulator,
  ref,
  set,
  get,
  update,
  onValue,
  onChildAdded,
  off,
  push,
  onDisconnect,
  runTransaction,
  remove,
  Database
} from 'firebase/database';
import { getAuth, connectAuthEmulator, signInAnonymously, Auth } from 'firebase/auth';
import { normalizeNameColor } from '../utils/nameColor';
import { ApiClient } from './api';
import { LocalStorageManager } from './storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'nint-demo.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://nint-demo-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'nint-demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'nint-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef123456'
};

export interface PlayerCosmetics {
  name_color?: string;
  name_decoration?: string;
  title?: string;
}

export type OnlineMatchMode = 'versus' | 'coop_boss' | 'blast';

export interface CoopBossState {
  hp: number;
  maxHp: number;
  level: number;
  roundStartedAt: number;
}

export interface CoopAttackState {
  dueAt: number;
  pick: string | null;
  pickAt: number;
  resolvedAt: number;
  resolvedAttack: string | null;
  cancelled: boolean;
  count: number;
}

export interface CoopVotes {
  retry?: Record<string, boolean>;
  next?: Record<string, boolean>;
}

export interface RemotePlayerState {
  displayName: string;
  userId?: string;
  rating?: number;
  cosmetics?: PlayerCosmetics;
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
  activeBombs?: { x: number; y: number }[];
  holdPiece?: string | null;
  queue?: string[];
  roundWins?: number;
  round?: number;
  /** Result of the round stored in `round`; the other client uses it to close
   * the round exactly once instead of trusting a running win counter. */
  roundOutcome?: 'win' | 'loss' | null;
  /** Shared start of the next round, written only by the round winner. */
  nextRound?: number | null;
  nextRoundAt?: number | null;
  /** Set by the winner of the third round so the other client ends the duel
   * even after its own round banner has already closed the round. */
  matchWon?: boolean;
  clearingRows?: number[];
  combo?: number;
  b2b?: boolean;
  b2bChain?: number;
  lastSeen: number;
}

function normalizePlayerCosmetics(cosmetics?: PlayerCosmetics | null): PlayerCosmetics {
  const color = normalizeNameColor(cosmetics?.name_color);
  const decoration = typeof cosmetics?.name_decoration === 'string'
    ? cosmetics.name_decoration.slice(0, 32)
    : 'none';
  const title = typeof cosmetics?.title === 'string'
    ? cosmetics.title.slice(0, 40)
    : '';
  return { name_color: color, name_decoration: decoration, title };
}

export class FirebaseRealtimeService {
  private static app: FirebaseApp | null = null;
  private static db: Database | null = null;
  private static auth: Auth | null = null;
  private static currentUid: string = '';
  private static uidLocked: boolean = false;
  private static isConfigured: boolean = false;
  // Firebase uid of the known opponent per match. Attacks from anyone else are
  // ignored, so a third account cannot inject garbage into a duel.
  private static opponentUids = new Map<string, string>();
  // Matches and rooms this browser created or joined, so old nodes can be
  // deleted later instead of piling up in the database forever.
  private static janitorScheduled = false;

  private static unavailableError(): Error {
    return new Error(
      import.meta.env.DEV
        ? 'Firebase Realtime Database is unavailable. Start the full development stack with "npm run dev" so the local Firebase emulator runs.'
        : 'Firebase is not configured. Please check your .env settings.'
    );
  }

  public static initialize(): boolean {
    if (this.app) return this.isConfigured;

    try {
      const isDemoConfig = !import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY === 'demo-api-key';
      // Local development works out of the box with the demo config; a real
      // Firebase project can still opt into the emulator explicitly.
      const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'
        || (import.meta.env.DEV && isDemoConfig);

      if (!isDemoConfig || useEmulator) {
        // Hot reloads and duplicate module instances must reuse the existing
        // Firebase app; initializing a second one throws duplicate-app and
        // would wrongly surface as "Realtime Database is unavailable".
        const existingApp = getApps()[0];
        this.app = existingApp ?? initializeApp(firebaseConfig);
        this.db = getDatabase(this.app);
        this.auth = getAuth(this.app);

        // Only a freshly created app needs emulator wiring: calling it again
        // on the shared, already-connected database throws and used to mark
        // this instance as unavailable.
        if (useEmulator && !existingApp) {
          try {
            const host = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1';
            const databasePort = Number(import.meta.env.VITE_FIREBASE_EMULATOR_PORT || 9000);
            const authPort = Number(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT || 9099);
            connectDatabaseEmulator(this.db, host, databasePort);
            connectAuthEmulator(this.auth, `http://${host}:${authPort}`, { disableWarnings: true });
          } catch (emulatorError) {
            // The shared app is already connected (for example after an HMR
            // module reload); its emulator connection is still valid.
            console.warn('Firebase emulator connection notice:', emulatorError);
          }
        }

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
    // The uid decides which players/{uid} entry this client owns. It must not
    // change between joining a room and writing/listening to that match, or a
    // late anonymous sign-in would make a client read its own entry as the
    // opponent and write updates to a second, orphaned one.
    if (this.uidLocked) return this.currentUid;
    const authUid = this.auth?.currentUser?.uid;
    if (authUid) this.currentUid = authUid;
    return this.currentUid;
  }

  public static async authenticate(_displayName: string = 'Player'): Promise<string> {
    this.initialize();
    if (this.isConfigured && this.auth) {
      try {
        if (this.auth.currentUser) {
          this.currentUid = this.auth.currentUser.uid;
          this.uidLocked = true;
          this.scheduleJanitor();
          return this.currentUid;
        }
        const cred = await signInAnonymously(this.auth);
        this.currentUid = cred.user.uid;
        this.uidLocked = true;
        this.scheduleJanitor();
        return this.currentUid;
      } catch (e) {
        console.warn('Anonymous auth failed, falling back to local UID:', e);
      }
    }
    return this.currentUid;
  }

  // Create an online room. The match id and seed come from the API so a
  // client can never invent a match that will later be accepted for ELO.
  public static async createRoom(roomCode: string, displayName: string, rating: number = 1000, userId?: string, ranked: boolean = false, cosmetics?: PlayerCosmetics, mode: OnlineMatchMode = 'versus'): Promise<{ matchId: string; seed: number }> {
    await this.authenticate(displayName);
    if (!this.isConfigured || !this.db) {
      throw this.unavailableError();
    }

    const uid = this.getUid();

    // Reject a duplicate room code before creating the server-side match.
    let existingRoom;
    try {
      existingRoom = await get(ref(this.db, `rooms/${roomCode}`));
    } catch {
      throw this.unavailableError();
    }
    if (existingRoom.exists()) {
      throw new Error(`Room code "${roomCode}" is already in use. Please try again.`);
    }

    const serverMatch = await ApiClient.createOnlineMatch(ranked, mode);
    const { matchId, seed } = serverMatch;

    try {
      const roomRef = ref(this.db, `rooms/${roomCode}`);
      await set(roomRef, {
        matchId,
        hostUid: uid,
        status: 'waiting',
        ranked: serverMatch.ranked,
        mode,
        createdAt: Date.now()
      });

      // Clear room on disconnect
      onDisconnect(roomRef).remove().catch(() => {});

      // Setup match entry
      const matchRef = ref(this.db, `matches/${matchId}`);
      await set(matchRef, {
        matchId,
        roomCode,
        status: 'waiting',
        ranked: serverMatch.ranked,
        mode,
        createdAt: Date.now(),
        players: {
          [uid]: {
            displayName,
            userId: userId || null,
            rating: rating || 1000,
            cosmetics: normalizePlayerCosmetics(cosmetics),
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
    } catch {
      // Do not leave a server-owned match waiting forever when Firebase is down.
      await ApiClient.cancelOnlineMatch(matchId).catch(() => {});
      throw this.unavailableError();
    }

    this.rememberNode('matches', matchId);
    this.rememberNode('rooms', roomCode);
    return { matchId, seed };
  }

  // Join an online room
  public static async joinRoom(roomCode: string, displayName: string, rating: number = 1000, userId?: string, ranked: boolean = false, cosmetics?: PlayerCosmetics, mode: OnlineMatchMode = 'versus'): Promise<{ matchId: string; seed: number }> {
    await this.authenticate(displayName);
    const uid = this.getUid();

    if (!this.isConfigured || !this.db) {
      throw this.unavailableError();
    }

    const roomRef = ref(this.db, `rooms/${roomCode}`);
    let snapshot;
    try {
      snapshot = await get(roomRef);
    } catch {
      throw this.unavailableError();
    }
    if (!snapshot.exists()) {
      throw new Error(`Room "${roomCode}" not found. Verify the code.`);
    }

    const roomData = snapshot.val();
    if (roomData.status !== 'waiting') {
      throw new Error('This room is no longer accepting players.');
    }
    if (roomData.hostUid === uid) {
      throw new Error('You cannot join your own room.');
    }
    if (Boolean(roomData.ranked) !== ranked) {
      throw new Error(ranked ? 'This room is not a ranked match.' : 'This room is ranked. Use Ranked Match to join.');
    }
    if ((roomData.mode || 'versus') !== mode) {
      throw new Error('This room was created for a different game mode.');
    }

    const matchId = roomData.matchId;

    const matchSnap = await get(ref(this.db, `matches/${matchId}`));
    if (!matchSnap.exists()) {
      throw new Error('Match expired or no longer available.');
    }

    const matchData = matchSnap.val();
    if (matchData.status !== 'waiting') {
      throw new Error('This match has already started.');
    }
    if (Object.keys(matchData.players || {}).length >= 2) {
      throw new Error('This room is already full.');
    }

    // The API validates that this account is the guest of a waiting
    // server-created match and returns the authoritative seed.
    const joined = await ApiClient.joinOnlineMatch(matchId);
    if (Boolean(joined.ranked) !== ranked) {
      throw new Error(ranked ? 'This room is not a ranked match.' : 'This room is ranked. Use Ranked Match to join.');
    }
    if ((joined.mode || 'versus') !== mode) {
      throw new Error('This room was created for a different online mode.');
    }

    // Register second player
    const playerRef = ref(this.db, `matches/${matchId}/players/${uid}`);
    await set(playerRef, {
      displayName,
      userId: userId || null,
      rating: rating || 1000,
      cosmetics: normalizePlayerCosmetics(cosmetics),
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

    this.rememberNode('matches', matchId);
    this.rememberNode('rooms', roomCode);
    return { matchId, seed: joined.seed };
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
    const attachTime = Date.now();

    // Use child_added so every attack is delivered exactly once, even when
    // several attacks arrive between two snapshots.
    const listener = onChildAdded(attacksRef, (snapshot) => {
      const attack = snapshot.val();
      if (!attack || attack.from === uid) return;
      const opponentUid = this.opponentUids.get(matchId);
      if (opponentUid && attack.from !== opponentUid) return;
      if (typeof attack.timestamp !== 'number' || attack.timestamp < attachTime - 1000) return;
      if (typeof attack.amount !== 'number' || !Number.isFinite(attack.amount)) return;
      const amount = Math.min(Math.max(Math.round(attack.amount), 0), 20);
      if (amount > 0) onAttackReceived(amount);
    });

    return () => off(attacksRef, 'child_added', listener);
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
  public static listenToOpponent(
    matchId: string,
    onOpponentUpdate: (opponent: RemotePlayerState) => void,
    selfUserId?: string
  ): () => void {
    if (!this.isConfigured || !this.db) {
      return () => {};
    }

    const uid = this.getUid();
    const playersRef = ref(this.db, `matches/${matchId}/players`);

    const listener = onValue(playersRef, (snapshot) => {
      if (snapshot.exists()) {
        const players = snapshot.val();
        for (const [pUid, pState] of Object.entries<any>(players)) {
          // Match on the server account id as well: it stays correct even if
          // this browser's anonymous uid was assigned late.
          const isSelf = pUid === uid || (selfUserId && pState?.userId === selfUserId);
          if (!isSelf) {
            this.opponentUids.set(matchId, pUid);
            onOpponentUpdate(pState);
            break;
          }
        }
      }
    });

    return () => {
      this.opponentUids.delete(matchId);
      off(playersRef, 'value', listener);
    };
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

  public static async setCoopLevel(matchId: string, level: number) {
    if (!this.isConfigured || !this.db) return;
    const clamped = Math.max(1, Math.min(10, Math.floor(level)));
    await set(ref(this.db, `matches/${matchId}/coop/levels/${this.getUid()}`), clamped);
  }

  public static listenToCoopLevels(
    matchId: string,
    onLevels: (levels: Record<string, number>) => void
  ): () => void {
    if (!this.isConfigured || !this.db) return () => {};
    const levelsRef = ref(this.db, `matches/${matchId}/coop/levels`);
    const listener = onValue(levelsRef, (snapshot) => {
      onLevels(snapshot.exists() ? snapshot.val() : {});
    });
    return () => off(levelsRef, 'value', listener);
  }

  public static async initializeCoopRound(matchId: string, level: number, maxHp: number) {
    if (!this.isConfigured || !this.db) return;
    const now = Date.now();
    await set(ref(this.db, `matches/${matchId}/coop/boss`), {
      hp: maxHp,
      maxHp,
      level,
      roundStartedAt: now
    } satisfies CoopBossState);
    await set(ref(this.db, `matches/${matchId}/coop/attack`), {
      dueAt: now + 30_000,
      pick: null,
      pickAt: 0,
      resolvedAt: 0,
      resolvedAttack: null,
      cancelled: false,
      count: 0
    } satisfies CoopAttackState);
    await set(ref(this.db, `matches/${matchId}/coop/votes`), null);
  }

  public static listenToCoopBoss(
    matchId: string,
    onBoss: (boss: CoopBossState | null) => void
  ): () => void {
    if (!this.isConfigured || !this.db) return () => {};
    const bossRef = ref(this.db, `matches/${matchId}/coop/boss`);
    const listener = onValue(bossRef, (snapshot) => {
      onBoss(snapshot.exists() ? snapshot.val() : null);
    });
    return () => off(bossRef, 'value', listener);
  }

  public static async damageCoopBoss(matchId: string, amount: number) {
    if (!this.isConfigured || !this.db) return;
    const damage = Math.max(0, Math.floor(amount));
    if (damage <= 0) return;
    const bossRef = ref(this.db, `matches/${matchId}/coop/boss`);
    await runTransaction(bossRef, (current: CoopBossState | null) => {
      if (!current) return current;
      return { ...current, hp: Math.max(0, current.hp - damage) };
    });
  }

  /** Development-only shortcut: set the shared co-op boss HP to zero. */
  public static async defeatCoopBoss(matchId: string) {
    if (!this.isConfigured || !this.db) return;
    const bossRef = ref(this.db, `matches/${matchId}/coop/boss`);
    await runTransaction(bossRef, (current: CoopBossState | null) => {
      if (!current) return current;
      return { ...current, hp: 0 };
    });
  }

  public static listenToCoopAttack(
    matchId: string,
    onAttack: (attack: CoopAttackState | null) => void
  ): () => void {
    if (!this.isConfigured || !this.db) return () => {};
    const attackRef = ref(this.db, `matches/${matchId}/coop/attack`);
    const listener = onValue(attackRef, (snapshot) => {
      onAttack(snapshot.exists() ? snapshot.val() : null);
    });
    return () => off(attackRef, 'value', listener);
  }

  public static async createCoopPendingAttack(matchId: string, attack: string) {
    if (!this.isConfigured || !this.db) return;
    const attackRef = ref(this.db, `matches/${matchId}/coop/attack`);
    await runTransaction(attackRef, (current: CoopAttackState | null) => {
      if (!current) return current;
      const now = Date.now();
      if (current.pick || now < current.dueAt) return current;
      return { ...current, pick: attack, pickAt: now };
    });
  }

  public static async resolveCoopAttack(
    matchId: string,
    cancelled: boolean
  ): Promise<CoopAttackState | null> {
    if (!this.isConfigured || !this.db) return null;
    const attackRef = ref(this.db, `matches/${matchId}/coop/attack`);
    const result = await runTransaction(attackRef, (current: CoopAttackState | null) => {
      if (!current || !current.pick) return current;
      const now = Date.now();
      return {
        ...current,
        pick: null,
        pickAt: 0,
        resolvedAt: now,
        resolvedAttack: current.pick,
        cancelled,
        count: (current.count || 0) + 1,
        dueAt: now + 30_000
      };
    });
    return (result.snapshot.val() as CoopAttackState | null) ?? null;
  }

  public static async requestCoopVote(matchId: string, kind: 'retry' | 'next') {
    if (!this.isConfigured || !this.db) return;
    await set(ref(this.db, `matches/${matchId}/coop/votes/${kind}/${this.getUid()}`), true);
  }

  public static listenToCoopVotes(
    matchId: string,
    onVotes: (votes: CoopVotes) => void
  ): () => void {
    if (!this.isConfigured || !this.db) return () => {};
    const votesRef = ref(this.db, `matches/${matchId}/coop/votes`);
    const listener = onValue(votesRef, (snapshot) => {
      onVotes(snapshot.exists() ? snapshot.val() : {});
    });
    return () => off(votesRef, 'value', listener);
  }

  // Trigger next match in the same room when both players agreed
  public static async createNextMatch(
    currentMatchId: string,
    roomCode: string
  ): Promise<{ nextMatchId: string; seed: number }> {
    if (!this.isConfigured || !this.db) {
      throw this.unavailableError();
    }

    // 1. Ask the API for a server-owned rematch before touching Firebase.
    const serverMatch = await ApiClient.createOnlineRematch(currentMatchId);
    const { matchId: nextMatchId, seed } = serverMatch;

    // 2. Fetch previous players to carry over display names and reset stats
    const currentSnap = await get(ref(this.db, `matches/${currentMatchId}`));
      const currentData = currentSnap.exists() ? currentSnap.val() : {};
      const previousPlayers = currentData.players || {};

      const freshPlayers: any = {};
      for (const [uid, p] of Object.entries<any>(previousPlayers)) {
        freshPlayers[uid] = {
          displayName: p.displayName || 'Player',
          userId: p.userId || null,
          rating: typeof p.rating === 'number' ? p.rating : 1000,
          cosmetics: p.cosmetics || normalizePlayerCosmetics(null),
          ready: true,
          score: 0,
          lines: 0,
          alive: true,
          connected: true,
          lastSeen: Date.now()
        };
      }

      // 3. Create the next match document
      await set(ref(this.db, `matches/${nextMatchId}`), {
        matchId: nextMatchId,
        roomCode,
        status: 'active',
        ranked: serverMatch.ranked,
        mode: currentData.mode || 'versus',
        createdAt: Date.now(),
        players: freshPlayers
      });

      // 4. Setup host onDisconnect on the new match
      const myUid = this.getUid();
      const myPlayerRef = ref(this.db, `matches/${nextMatchId}/players/${myUid}`);
      onDisconnect(myPlayerRef).update({
        connected: false,
        alive: false,
        lastSeen: Date.now()
      }).catch(() => {});

      // 5. Update room to point to the new match
      await update(ref(this.db, `rooms/${roomCode}`), {
        matchId: nextMatchId,
        status: 'active'
      });

      // 6. Notify both participants through the previous match
    await set(ref(this.db, `matches/${currentMatchId}/nextMatch`), {
      nextMatchId,
      seed
    });

    return { nextMatchId, seed };
  }

  // Create a fresh Blast duel after both players asked for a rematch. The new
  // match is a normal unranked Blast room; its code and seed are shared through
  // the finished match so both clients attach to it at the same time.
  public static async createBlastRematch(
    currentMatchId: string,
    roomCode: string,
    displayName: string,
    rating: number = 1000,
    userId?: string,
    cosmetics?: PlayerCosmetics
  ): Promise<{ nextMatchId: string; seed: number; roomCode: string }> {
    if (!this.isConfigured || !this.db) {
      throw this.unavailableError();
    }

    const { matchId: nextMatchId, seed } = await this.createRoom(
      roomCode,
      displayName,
      rating,
      userId,
      false,
      cosmetics,
      'blast'
    );

    await update(ref(this.db, `rooms/${roomCode}`), { status: 'active' });
    await set(ref(this.db, `matches/${currentMatchId}/nextMatch`), {
      nextMatchId,
      seed,
      roomCode
    });

    return { nextMatchId, seed, roomCode };
  }

  // Listen to next match trigger
  public static listenToNextMatch(
    matchId: string,
    onNextMatch: (data: { nextMatchId: string; seed: number; roomCode?: string }) => void
  ): () => void {
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
    userId?: string,
    ranked: boolean = false,
    cosmetics?: PlayerCosmetics,
    mode: OnlineMatchMode = 'versus'
  ): Promise<() => Promise<void>> {
    await this.authenticate(displayName);
    const uid = this.getUid();

    if (!this.isConfigured || !this.db) {
      throw this.unavailableError();
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
          if (otherUid !== uid && entry && entry.roomCode && Boolean(entry.ranked) === ranked && (entry.mode || 'versus') === mode && (now - (entry.createdAt || 0) < 60000)) {
            // Verify the room is still waiting
            const roomSnap = await get(ref(this.db!, `rooms/${entry.roomCode}`));
            if (roomSnap.exists() && roomSnap.val().status === 'waiting') {
              matchFound = true;
              isDisposed = true;

              if (pollTimer) clearInterval(pollTimer);
              if (unsubscribeStart) unsubscribeStart();

              // Remove our own queue entry if we had one
              set(myQueueRef, null).catch(() => {});

              const { matchId, seed } = await this.joinRoom(entry.roomCode, displayName, rating, userId, ranked, cosmetics, mode);
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
    const { matchId, seed } = await this.createRoom(roomCode, displayName, rating, userId, ranked, cosmetics, mode);

    if (isDisposed) {
      // User cancelled during room creation
      ApiClient.sendBeaconForfeit({ matchId, result: 'cancel' });
      this.leaveRoom(roomCode, matchId, true).catch(() => {});
      return async () => {};
    }

    // Publish our room under matchmaking_queue/$uid (allowed by auth.uid == $uid)
    await set(myQueueRef, {
      uid,
      displayName,
      userId: userId || null,
      rating: rating || 1000,
      roomCode,
      ranked,
      mode,
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
          if (otherUid !== uid && entry && entry.roomCode && Boolean(entry.ranked) === ranked && (entry.mode || 'versus') === mode && (now - (entry.createdAt || 0) < 60000)) {
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
                ApiClient.sendBeaconForfeit({ matchId, result: 'cancel' });
                this.leaveRoom(roomCode, matchId, true).catch(() => {});

                // Join the older room
                const res = await this.joinRoom(entry.roomCode, displayName, rating, userId, ranked, cosmetics, mode);
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
        ApiClient.sendBeaconForfeit({ matchId, result: 'cancel' });
        await set(myQueueRef, null);
        await this.leaveRoom(roomCode, matchId, true);
      } catch (e) {
        console.warn('Error cancelling quick search:', e);
      }
    };
  }

  // Clean room when leaving
  // The database keeps no index of finished games: a browser only knows the
  // nodes it took part in. Recording them lets the janitor below delete them
  // once they are old enough, so the tree does not grow without bound.
  private static rememberNode(kind: 'matches' | 'rooms', id: string): void {
    if (!id) return;
    const key = kind === 'matches' ? 'rtdb_matches' : 'rtdb_rooms';
    const list = LocalStorageManager.getItem<string[]>(key, []);
    LocalStorageManager.setItem(key, [id, ...list.filter((entry) => entry !== id)].slice(0, 50));
  }

  private static forgetNode(kind: 'matches' | 'rooms', id: string): void {
    const key = kind === 'matches' ? 'rtdb_matches' : 'rtdb_rooms';
    const list = LocalStorageManager.getItem<string[]>(key, []);
    LocalStorageManager.setItem(key, list.filter((entry) => entry !== id));
  }

  private static scheduleJanitor(): void {
    if (this.janitorScheduled || !this.isConfigured || !this.db) return;
    this.janitorScheduled = true;
    setTimeout(() => {
      void this.cleanupStaleData();
    }, 2500);
  }

  private static nodeTimestamp(data: any): number {
    let newest = typeof data?.createdAt === 'number' ? data.createdAt : 0;
    for (const player of Object.values<any>(data?.players || {})) {
      if (typeof player?.lastSeen === 'number' && player.lastSeen > newest) {
        newest = player.lastSeen;
      }
    }
    return newest;
  }

  /**
   * Deletes the matches and rooms this browser took part in once they are old.
   * A finished match is kept for two hours so a late result or rematch screen
   * still works; an abandoned active match is dropped after a day. The rules
   * only accept these deletes for a participant and an old node, so a stale tab
   * can never wipe a game that is still being played.
   */
  public static async cleanupStaleData(): Promise<void> {
    if (!this.isConfigured || !this.db) return;
    const db = this.db;

    const matchIds = LocalStorageManager.getItem<string[]>('rtdb_matches', []);
    const remainingMatches: string[] = [];
    for (const matchId of matchIds) {
      try {
        const snapshot = await get(ref(db, `matches/${matchId}`));
        if (!snapshot.exists()) continue;
        const data = snapshot.val();
        const age = Date.now() - this.nodeTimestamp(data);
        const ttl = data?.status === 'active' ? 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
        if (age < ttl) {
          remainingMatches.push(matchId);
          continue;
        }
        await remove(ref(db, `matches/${matchId}`));
      } catch {
        remainingMatches.push(matchId);
      }
    }
    LocalStorageManager.setItem('rtdb_matches', remainingMatches);

    const roomCodes = LocalStorageManager.getItem<string[]>('rtdb_rooms', []);
    const remainingRooms: string[] = [];
    for (const roomCode of roomCodes) {
      try {
        const snapshot = await get(ref(db, `rooms/${roomCode}`));
        if (!snapshot.exists()) continue;
        const createdAt = typeof snapshot.val()?.createdAt === 'number' ? snapshot.val().createdAt : 0;
        if (createdAt === 0 || Date.now() - createdAt < 24 * 60 * 60 * 1000) {
          remainingRooms.push(roomCode);
          continue;
        }
        await remove(ref(db, `rooms/${roomCode}`));
      } catch {
        remainingRooms.push(roomCode);
      }
    }
    LocalStorageManager.setItem('rtdb_rooms', remainingRooms);
  }

  public static async leaveRoom(roomCode: string, matchId: string, isHost: boolean = false) {
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
        // Only the host owns the room node; guests just mark themselves offline.
        if (roomCode && isHost) {
          await set(ref(this.db, `rooms/${roomCode}`), null);
        }
        // A host who walks away from an empty room takes the match with it, so
        // an abandoned lobby does not sit in the database until the janitor is
        // allowed to delete it two hours later.
        if (matchId && isHost) {
          const snapshot = await get(ref(this.db, `matches/${matchId}`));
          const match = snapshot.val();
          const others = Object.keys(match?.players || {}).filter((playerUid) => playerUid !== this.getUid());
          if (match?.status === 'waiting' && others.length === 0) {
            await remove(ref(this.db, `matches/${matchId}`));
            this.forgetNode('matches', matchId);
          }
        }
      } catch (e) {
        console.warn('Error cleaning up room:', e);
      }
    }
  }
}
