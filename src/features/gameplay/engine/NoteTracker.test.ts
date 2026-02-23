import { describe, it, expect, vi } from 'vitest';
import { NoteTracker } from './NoteTracker';
import { Note, Lane } from '@/domain/types';
import { TIMING_WINDOWS, NOTE_FALL_DURATION } from '@/domain/constants';

describe('NoteTracker', () => {
    const createNote = (id: string, time: number, lane: Lane): Note => ({
        id,
        time,
        lane,
        type: 'normal'
    });

    it('should spawn a note and track it', () => {
        const tracker = new NoteTracker([], vi.fn());
        const note = createNote('1', 2.0, 0);

        tracker.spawnNote(note);

        const active = tracker.getActiveNotes();
        expect(active.length).toBe(1);
        expect(active[0].id).toBe('1');
        expect(active[0].isHit).toBe(false);
        expect(active[0].isMissed).toBe(false);
        expect(active[0].spawnTime).toBe(2.0 - NOTE_FALL_DURATION);
    });

    it('should judge a perfect hit when within perfect window', () => {
        const tracker = new NoteTracker([], vi.fn());
        tracker.spawnNote(createNote('1', 2.0, 1));

        // Time is exactly the scheduled time
        const result = tracker.judgeHit(1, 2.0);

        expect(result).not.toBeNull();
        expect(result?.judgment).toBe('perfect');
        expect(result?.delta).toBe(0);

        // Note should be removed from active notes
        expect(tracker.getActiveNotes().length).toBe(0);
    });

    it('should judge a great hit', () => {
        const tracker = new NoteTracker([], vi.fn());
        tracker.spawnNote(createNote('1', 2.0, 1));

        // Outside perfect (30ms), inside great (70ms)
        const hitTime = 2.0 + (TIMING_WINDOWS.perfect + 10) / 1000;
        const result = tracker.judgeHit(1, hitTime);

        expect(result?.judgment).toBe('great');
    });

    it('should judge a good hit', () => {
        const tracker = new NoteTracker([], vi.fn());
        tracker.spawnNote(createNote('1', 2.0, 1));

        // Outside great (70ms), inside good (120ms)
        const hitTime = 2.0 + (TIMING_WINDOWS.great + 10) / 1000;
        const result = tracker.judgeHit(1, hitTime);

        expect(result?.judgment).toBe('good');
    });

    it('should return null (miss/ghost) if hit is outside good window', () => {
        const tracker = new NoteTracker([], vi.fn());
        tracker.spawnNote(createNote('1', 2.0, 1));

        // Outside good (120ms)
        const hitTime = 2.0 + (TIMING_WINDOWS.good + 50) / 1000;
        const result = tracker.judgeHit(1, hitTime);

        expect(result).toBeNull();
        // Note should still be active
        expect(tracker.getActiveNotes().length).toBe(1);
    });

    it('should return null if hit is in the wrong lane', () => {
        const tracker = new NoteTracker([], vi.fn());
        tracker.spawnNote(createNote('1', 2.0, 1));

        const result = tracker.judgeHit(2, 2.0); // Wrong lane

        expect(result).toBeNull();
        expect(tracker.getActiveNotes().length).toBe(1);
    });

    it('should trigger miss callback when note stays unhit past the good window', () => {
        const onMiss = vi.fn();
        const tracker = new NoteTracker([], onMiss);
        tracker.spawnNote(createNote('1', 2.0, 1));

        // Move time way past the note's target time
        const pastTime = 2.0 + (TIMING_WINDOWS.good + 50) / 1000;
        tracker.update(pastTime);

        expect(onMiss).toHaveBeenCalledWith('1', 1);
        expect(tracker.getActiveNotes().length).toBe(0); // Should be cleaned up
    });

    it('should get nearest note delta in ms', () => {
        const tracker = new NoteTracker([], vi.fn());
        tracker.spawnNote(createNote('1', 2.0, 1));

        // Nearest delta for hit at 1.9s should be -100ms
        const delta = tracker.getNearestNoteDelta(1, 1.9);
        // Using closeTo because of float math issues (1.9 - 2.0 = -0.10000000000000009)
        expect(delta).toBeCloseTo(-100, 1);
    });
});
