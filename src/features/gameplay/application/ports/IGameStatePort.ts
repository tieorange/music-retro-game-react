import { GamePhase, HitResult } from '@/features/gameplay/domain/types';
import { Song } from '@/features/audio/domain/types';

export interface IGameStatePort {
    readonly song: Song | null;
    readonly score: number;
    readonly hitResults: HitResult[];

    setCurrentTime(time: number): void;
    setPhase(phase: GamePhase): void;
    updateScoreAndCombo(score: number, combo: number, multiplier: number): void;
    addHitResult(result: HitResult): void;
    setFinalScore(finalScore: any): void; // Using any or GameScore depending on what's easiest to import, but preferably GameScore
}
