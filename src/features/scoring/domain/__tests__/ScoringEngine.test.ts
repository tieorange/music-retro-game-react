import { describe, it, expect } from 'vitest';
import { ScoringEngine } from '../ScoringEngine';
import { HitResult } from '@/features/gameplay/domain/types';
import { SCORE_VALUES } from '@/features/gameplay/domain/constants';

describe('ScoringEngine', () => {
    it('should calculate individual score based on judgment and multiplier', () => {
        const engine = new ScoringEngine();

        expect(engine.calculateScore('perfect', 4)).toBe(SCORE_VALUES.perfect * 4);
        expect(engine.calculateScore('great', 2)).toBe(SCORE_VALUES.great * 2);
        expect(engine.calculateScore('good', 1)).toBe(SCORE_VALUES.good * 1);
        expect(engine.calculateScore('miss', 8)).toBe(0);
    });

    it('should calculate final score perfectly (S grade)', () => {
        const engine = new ScoringEngine();

        const hitResults: HitResult[] = Array.from({ length: 100 }, (_, i) => ({
            noteId: String(i),
            judgment: 'perfect',
            delta: 5,
            comboAtHit: i + 1
        }));

        const finalScore = engine.calculateFinalScore('song1', 'Test Song', 100, hitResults, 100, 30000);

        expect(finalScore.perfects).toBe(100);
        expect(finalScore.misses).toBe(0);
        expect(finalScore.accuracy).toBe(100);
        expect(finalScore.grade).toBe('S');
        expect(finalScore.maxCombo).toBe(100);
        expect(finalScore.score).toBe(30000);
    });

    it('should calculate final score with mixed results', () => {
        const engine = new ScoringEngine();

        const hitResults: HitResult[] = [
            { noteId: '1', judgment: 'perfect', delta: 0, comboAtHit: 1 }, // 1.0 weight
            { noteId: '2', judgment: 'great', delta: 0, comboAtHit: 2 },   // 0.75 weight
            { noteId: '3', judgment: 'good', delta: 0, comboAtHit: 3 },    // 0.5 weight
            { noteId: '4', judgment: 'miss', delta: 0, comboAtHit: 0 },    // 0 weight
        ];

        // 4 total notes, weighted sum = 1 + 0.75 + 0.5 = 2.25
        // accuracy = (2.25 / 4) * 100 = 56.25%

        const finalScore = engine.calculateFinalScore('song1', 'Test', 4, hitResults, 3, 600);

        expect(finalScore.perfects).toBe(1);
        expect(finalScore.greats).toBe(1);
        expect(finalScore.goods).toBe(1);
        expect(finalScore.misses).toBe(1);
        expect(finalScore.accuracy).toBe(56.25);
        expect(finalScore.grade).toBe('C'); // Below 70% threshold
    });

    it('should add unaccounted notes as misses', () => {
        const engine = new ScoringEngine();

        const hitResults: HitResult[] = [
            { noteId: '1', judgment: 'perfect', delta: 0, comboAtHit: 1 }
        ];

        // 10 total notes, but only 1 hit recorded. The other 9 should be misses.
        const finalScore = engine.calculateFinalScore('song1', 'Test', 10, hitResults, 1, 300);

        expect(finalScore.perfects).toBe(1);
        expect(finalScore.misses).toBe(9);
        expect(finalScore.accuracy).toBe(10); // 1.0 / 10 * 100
    });
});
