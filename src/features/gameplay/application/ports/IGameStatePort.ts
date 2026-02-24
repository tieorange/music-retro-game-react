import { GamePhase, HitResult } from '@/features/gameplay/domain/types';
import { Song } from '@/features/audio/domain/types';
import { GameScore } from '@/features/scoring/domain/types';

export interface IGameStatePort {
    readonly song: Song | null;

    setCurrentTime(time: number): void;
    setPhase(phase: GamePhase): void;
    updateScoreAndCombo(score: number, combo: number, multiplier: number): void;
    addHitResult(result: HitResult): void;
    setFinalScore(finalScore: GameScore): void;
}
