import { Note, HitResult, HitJudgment, Lane } from '@/domain/types';
import { TIMING_WINDOWS, NOTE_FALL_DURATION } from '@/domain/constants';

export interface ActiveNote extends Note {
    isHit: boolean;
    isMissed: boolean;
    spawnTime: number;
}

export class NoteTracker {
    private active: Map<string, ActiveNote> = new Map();
    private maxMissTime = TIMING_WINDOWS.good / 1000; // seconds
    private onMissCallback: (noteId: string, lane: Lane) => void;

    constructor(notes: Note[], onMiss: (noteId: string, lane: Lane) => void) {
        // We don't need 'notes' array anymore since scheduler spawns them dynamically
        // But we keep the signature for compatibility or future use, so we just log it or ignore
        console.debug(`NoteTracker initialized with ${notes.length} notes`);
        this.onMissCallback = onMiss;
    }

    public spawnNote(note: Note): void {
        this.active.set(note.id, {
            ...note,
            isHit: false,
            isMissed: false,
            spawnTime: note.time - NOTE_FALL_DURATION,
        });
    }

    public update(currentTime: number): void {
        // Check for missed notes
        for (const [id, activeNote] of this.active.entries()) {
            if (!activeNote.isHit && !activeNote.isMissed) {
                if (currentTime > activeNote.time + this.maxMissTime) {
                    activeNote.isMissed = true;
                    this.onMissCallback(activeNote.id, activeNote.lane);
                    // We can remove it from active after some time, or let it fall off screen
                    // For now, let the renderer remove it when it's way past
                    this.active.delete(id);
                }
            }
        }
    }

    public judgeHit(lane: Lane, time: number): HitResult | null {
        // Find closest active note in this lane
        let closestNote: ActiveNote | null = null;
        let minDelta = Infinity;

        for (const activeNote of this.active.values()) {
            if (!activeNote.isHit && !activeNote.isMissed && activeNote.lane === lane) {
                const delta = time - activeNote.time;
                if (Math.abs(delta) < Math.abs(minDelta)) {
                    minDelta = delta;
                    closestNote = activeNote;
                }
            }
        }

        if (!closestNote) return null;

        const absDeltaMs = Math.abs(minDelta) * 1000;

        // Check if within largest window
        if (absDeltaMs <= TIMING_WINDOWS.good) {
            closestNote.isHit = true;
            let judgment: HitJudgment = 'miss';

            if (absDeltaMs <= TIMING_WINDOWS.perfect) judgment = 'perfect';
            else if (absDeltaMs <= TIMING_WINDOWS.great) judgment = 'great';
            else judgment = 'good';

            this.active.delete(closestNote.id);

            return {
                noteId: closestNote.id,
                judgment,
                delta: minDelta * 1000,
                comboAtHit: 0, // Set by ComboTracker later
            };
        }

        return null;
    }

    public getNearestNoteDelta(lane: Lane, time: number): number | null {
        let minDelta = Infinity;

        for (const activeNote of this.active.values()) {
            if (!activeNote.isHit && !activeNote.isMissed && activeNote.lane === lane) {
                const delta = time - activeNote.time;
                if (Math.abs(delta) < Math.abs(minDelta)) {
                    minDelta = delta;
                }
            }
        }

        return minDelta === Infinity ? null : minDelta * 1000;
    }

    public getActiveNotes(): ActiveNote[] {
        return Array.from(this.active.values());
    }
}
