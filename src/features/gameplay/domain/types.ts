import { Song } from '../../audio/domain/types';
import { BeatMap } from '../../analysis/domain/types';
import { GameScore } from '../../scoring/domain/types';

export type Lane = 0 | 1 | 2 | 3;
export type GameMode = 'classic' | 'trackpad';
export type GameDifficulty = 'easy' | 'normal' | 'hard' | 'expert';

export interface Note {
    id: string;
    time: number;            // scheduled hit time in seconds
    lane: Lane;
    type: 'normal' | 'hold';
    duration?: number;       // for hold notes (future)
}

export type HitJudgment = 'perfect' | 'great' | 'good' | 'miss';

export interface HitResult {
    noteId: string;
    judgment: HitJudgment;
    delta: number;           // signed ms offset (negative = early)
    comboAtHit: number;
}

export type GamePhase =
    | 'idle'        // upload screen
    | 'analyzing'   // essentia running
    | 'ready'       // analysis done, waiting to start
    | 'countdown'   // 3-2-1
    | 'playing'     // active gameplay
    | 'paused'
    | 'results';

export interface GameState {
    phase: GamePhase;
    mode: GameMode;
    difficulty: GameDifficulty;
    song: Song | null;
    beatMap: BeatMap | null;
    currentTime: number;
    combo: number;
    multiplier: number;      // 1, 2, 4, or 8
    score: number;
    hitResults: HitResult[];
    finalScore: GameScore | null;
    highScores: GameScore[];
}

export interface HitEvent {
    judgment: HitJudgment;
    lane: Lane;
    combo: number;
    multiplier: number;
}

export interface MissEvent {
    lane: Lane;
}

export interface NearMissEvent {
    lane: Lane;
}

export interface GhostPressEvent {
    lane: Lane;
}

export interface ComboMilestoneEvent {
    combo: number;
}

export interface ComboBreakEvent {
    previousCombo: number;
}

export type GameEvent =
    | { type: 'hit'; data: HitEvent }
    | { type: 'miss'; data: MissEvent }
    | { type: 'near-miss'; data: NearMissEvent }
    | { type: 'ghost-press'; data: GhostPressEvent }
    | { type: 'combo-milestone'; data: ComboMilestoneEvent }
    | { type: 'combo-break'; data: ComboBreakEvent }
    | { type: 'beat'; data: { time: number } };
