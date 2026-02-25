import { HitJudgment, HitResult } from '@/features/gameplay/domain/types';
import { GameScore } from '@/features/scoring/domain/types';
import { SCORE_VALUES, GRADE_THRESHOLDS } from '@/features/gameplay/domain/constants';
import { logWarn } from '@/core/logging';

export class ScoringEngine {
    public calculateScore(judgment: HitJudgment, multiplier: number): number {
        return SCORE_VALUES[judgment] * multiplier;
    }

    public calculateFinalScore(
        songId: string,
        songName: string,
        totalNotes: number,
        hitResults: HitResult[],
        maxCombo: number,
        totalScore: number
    ): GameScore {
        let perfects = 0;
        let greats = 0;
        let goods = 0;
        let misses = 0;

        let weightedSum = 0;

        hitResults.forEach((r) => {
            switch (r.judgment) {
                case 'perfect':
                    perfects++;
                    weightedSum += 1.0;
                    break;
                case 'great':
                    greats++;
                    weightedSum += 0.75;
                    break;
                case 'good':
                    goods++;
                    weightedSum += 0.5;
                    break;
                case 'miss':
                    misses++;
                    weightedSum += 0;
                    break;
            }
        });

        // Handle missed notes that weren't recorded (though GameEngine should record them)
        const unaccounted = Math.max(0, totalNotes - hitResults.length);
        if (unaccounted > 0) misses += unaccounted;

        const accuracy = Math.min(100, Math.max(0, totalNotes > 0 ? (weightedSum / totalNotes) * 100 : 0));

        if (hitResults.length > totalNotes) {
            logWarn('scoring.hit_result.overflow', {
                hitResults: hitResults.length,
                totalNotes,
                delta: hitResults.length - totalNotes,
            });
        }

        let grade: 'S' | 'A' | 'B' | 'C' = 'C';
        if (accuracy >= GRADE_THRESHOLDS.S) grade = 'S';
        else if (accuracy >= GRADE_THRESHOLDS.A) grade = 'A';
        else if (accuracy >= GRADE_THRESHOLDS.B) grade = 'B';

        return {
            songId,
            songName,
            totalNotes,
            perfects,
            greats,
            goods,
            misses,
            maxCombo,
            score: totalScore,
            accuracy,
            grade,
            date: Date.now()
        };
    }
}
