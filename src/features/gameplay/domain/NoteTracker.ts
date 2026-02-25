import { Note, HitResult, HitJudgment, Lane } from '@/features/gameplay/domain/types';
import { TIMING_WINDOWS, NOTE_FALL_DURATION } from '@/features/gameplay/domain/constants';

export interface ActiveNote extends Note {
    isHit: boolean;
    isMissed: boolean;
    spawnTime: number;
    initialProgress?: number;
    isHeld?: boolean;
    holdStartTime?: number;
    lastTickIndex?: number;
}

export class NoteTracker {
    private active: Map<string, ActiveNote> = new Map();
    private maxMissTime = TIMING_WINDOWS.good / 1000; // seconds
    private onMissCallback?: (noteId: string, lane: Lane) => void;

    constructor(onMiss?: (noteId: string, lane: Lane) => void) {
        this.onMissCallback = onMiss;
    }

    public setOnMiss(onMiss: (noteId: string, lane: Lane) => void) {
        this.onMissCallback = onMiss;
    }

    public spawnNote(note: Note, initialProgress?: number): void {
        this.active.set(note.id, {
            ...note,
            isHit: false,
            isMissed: false,
            spawnTime: note.time - NOTE_FALL_DURATION,
            initialProgress
        });
    }

    public update(currentTime: number): { holdTicks: number } {
        let holdTicks = 0;

        for (const [id, activeNote] of this.active.entries()) {
            if (activeNote.isHeld) {
                if (activeNote.holdStartTime === undefined) continue;

                const endTime = activeNote.time + (activeNote.duration || 0);
                if (currentTime >= endTime) {
                    activeNote.isHit = true;
                    this.active.delete(id);
                } else {
                    const ticksSoFar = Math.floor((currentTime - activeNote.holdStartTime) / 0.1);
                    const newTicks = ticksSoFar - (activeNote.lastTickIndex || 0);
                    if (newTicks > 0) {
                        holdTicks += newTicks;
                        activeNote.lastTickIndex = ticksSoFar;
                    }
                }
            } else if (!activeNote.isHit && !activeNote.isMissed) {
                // Normal Miss Check
                if (currentTime > activeNote.time + this.maxMissTime) {
                    activeNote.isMissed = true;
                    if (this.onMissCallback) this.onMissCallback(activeNote.id, activeNote.lane);
                    this.active.delete(id);
                }
            }
        }
        return { holdTicks };
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
            let judgment: HitJudgment = 'miss';

            if (absDeltaMs <= TIMING_WINDOWS.perfect) judgment = 'perfect';
            else if (absDeltaMs <= TIMING_WINDOWS.great) judgment = 'great';
            else judgment = 'good';

            if (closestNote.type === 'hold') {
                closestNote.isHeld = true;
                closestNote.holdStartTime = time;
                closestNote.lastTickIndex = 0;
            } else {
                closestNote.isHit = true;
                this.active.delete(closestNote.id);
            }

            return {
                noteId: closestNote.id,
                judgment,
                delta: minDelta * 1000,
                comboAtHit: 0, // Set by ComboTracker later
            };
        }

        return null;
    }

    public judgeRelease(lane: Lane, time: number): 'miss' | 'complete' | null {
        for (const [id, note] of this.active.entries()) {
            if (note.lane === lane && note.isHeld) {
                const releaseTarget = note.time + (note.duration || 0);
                // early release by more than 200ms
                if (releaseTarget - time > 0.2) {
                    note.isMissed = true;
                    this.active.delete(id);
                    return 'miss';
                } else {
                    note.isHit = true;
                    this.active.delete(id);
                    return 'complete';
                }
            }
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

    public reset(): void {
        this.active.clear();
    }
}
