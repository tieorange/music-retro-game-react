import { describe, it, expect } from 'vitest';
import { ComboTracker } from '../ComboTracker';

describe('ComboTracker', () => {
    it('should initialize with 0 combo and 1x multiplier', () => {
        const tracker = new ComboTracker();
        expect(tracker.combo).toBe(0);
        expect(tracker.maxCombo).toBe(0);
        expect(tracker.multiplier).toBe(1);
    });

    it('should correctly increment combo and maxCombo on hits', () => {
        const tracker = new ComboTracker();

        tracker.hit('perfect');
        tracker.hit('great');
        tracker.hit('good');

        expect(tracker.combo).toBe(3);
        expect(tracker.maxCombo).toBe(3);
    });

    it('should reset combo but preserve maxCombo on miss', () => {
        const tracker = new ComboTracker();

        for (let i = 0; i < 5; i++) tracker.hit('perfect'); // combo 5
        expect(tracker.maxCombo).toBe(5);

        tracker.hit('miss');
        expect(tracker.combo).toBe(0);
        expect(tracker.maxCombo).toBe(5);

        tracker.hit('perfect');
        expect(tracker.combo).toBe(1);
        expect(tracker.maxCombo).toBe(5); // Still 5
    });

    it('should step up multiplier at thresholds (10, 30, 50)', () => {
        const tracker = new ComboTracker();

        // 0 to 9 -> 1x
        for (let i = 0; i < 9; i++) tracker.hit('perfect');
        expect(tracker.combo).toBe(9);
        expect(tracker.multiplier).toBe(1);

        // 10 -> 2x
        tracker.hit('perfect');
        expect(tracker.combo).toBe(10);
        expect(tracker.multiplier).toBe(2);

        // 29 still 2x
        for (let i = 0; i < 19; i++) tracker.hit('perfect');
        expect(tracker.multiplier).toBe(2);

        // 30 -> 4x
        tracker.hit('perfect');
        expect(tracker.multiplier).toBe(4);

        // 50 -> 8x
        for (let i = 0; i < 20; i++) tracker.hit('perfect');
        expect(tracker.multiplier).toBe(8);
    });

    it('should drop multiplier to 1x on miss', () => {
        const tracker = new ComboTracker();
        for (let i = 0; i < 60; i++) tracker.hit('perfect');
        expect(tracker.multiplier).toBe(8);

        tracker.hit('miss');
        expect(tracker.combo).toBe(0);
        expect(tracker.multiplier).toBe(1);
    });

    it('should return structured ComboResult detailing milestones and breaks', () => {
        const tracker = new ComboTracker();

        let res = tracker.hit('perfect');
        expect(res).toEqual({ combo: 1, multiplier: 1, isMilestone: false, isBreak: false });

        for (let i = 0; i < 8; i++) tracker.hit('perfect'); // 1 + 8 = 9

        res = tracker.hit('perfect'); // 10th hit
        expect(res).toEqual({ combo: 10, multiplier: 2, isMilestone: true, isBreak: false });

        res = tracker.hit('miss');
        expect(res).toEqual({ combo: 0, multiplier: 1, isMilestone: false, isBreak: true });
    });
});
