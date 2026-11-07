import { GameEngine } from '../engine/gameEngine';

export interface VersusMatchResult {
  winner: 'player' | 'opponent';
  reason: 'top_out' | 'disconnect' | 'forfeit';
  durationMs: number;
  playerScore: number;
  playerLines: number;
  opponentScore: number;
  opponentLines: number;
}

export class VersusMatch {
  public playerEngine: GameEngine;
  public opponentEngine: GameEngine;
  public onMatchEnd?: (result: VersusMatchResult) => void;
  public isFinished: boolean = false;
  private startTime: number = 0;

  constructor(
    playerEngine: GameEngine,
    opponentEngine: GameEngine,
    onMatchEnd?: (result: VersusMatchResult) => void
  ) {
    this.playerEngine = playerEngine;
    this.opponentEngine = opponentEngine;
    this.onMatchEnd = onMatchEnd;

    // Connect garbage pipelines
    this.playerEngine.events.onGarbageSent = (amount) => {
      this.opponentEngine.garbageManager.enqueueGarbage(amount);
    };

    this.opponentEngine.events.onGarbageSent = (amount) => {
      this.playerEngine.garbageManager.enqueueGarbage(amount);
    };

    // Detect game-overs
    this.playerEngine.events.onGameOver = () => {
      this.finishMatch('opponent', 'top_out');
    };

    this.opponentEngine.events.onGameOver = () => {
      this.finishMatch('player', 'top_out');
    };
  }

  public start() {
    this.isFinished = false;
    this.startTime = Date.now();
    this.playerEngine.start();
    this.opponentEngine.start();
  }

  public finishMatch(winner: 'player' | 'opponent', reason: 'top_out' | 'disconnect' | 'forfeit') {
    if (this.isFinished) return;
    this.isFinished = true;

    if (this.playerEngine.state === 'playing') {
      this.playerEngine.state = 'gameover';
    }
    if (this.opponentEngine.state === 'playing') {
      this.opponentEngine.state = 'gameover';
    }

    const durationMs = Date.now() - this.startTime;
    this.onMatchEnd?.({
      winner,
      reason,
      durationMs,
      playerScore: this.playerEngine.score,
      playerLines: this.playerEngine.lines,
      opponentScore: this.opponentEngine.score,
      opponentLines: this.opponentEngine.lines
    });
  }
}
