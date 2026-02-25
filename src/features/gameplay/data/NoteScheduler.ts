import * as Tone from 'tone';
import { Note } from '@/features/gameplay/domain/types';
import { NOTE_FALL_DURATION } from '@/features/gameplay/domain/constants';
import { INoteSchedulerPort } from '@/features/gameplay/application/ports/INoteSchedulerPort';

export class NoteScheduler implements INoteSchedulerPort {
    private events: number[] = [];

    public scheduleAll(notes: Note[], onSpawn: (note: Note, initialProgress?: number) => void): void {
        this.clear(); // Ensure clean state

        notes.forEach((note) => {
            // Spawn time is when the note should start falling visually
            // Audio is delayed or game starts at negative transport time?
            // Transport starts at 0, if note is at 1.0s, spawn at 1.0 - 2.0 = -1.0
            // So Transport needs to start at -NOTE_FALL_DURATION?
            // Actually, Tone.Transport starts at 0. If note time < FALL_DURATION, it spawns immediately.
            // Better to pad the start of the Transport.
            const spawnTime = note.time - NOTE_FALL_DURATION;

            if (spawnTime < 0) {
                // Spawn immediately when Transport starts, with pre-computed progress
                const initialProgress = Math.min(1, -spawnTime / NOTE_FALL_DURATION);
                const eventId = Tone.getTransport().schedule((audioTime) => {
                    Tone.Draw.schedule(() => onSpawn(note, initialProgress), audioTime);
                }, 0);
                this.events.push(eventId);
            } else {
                // Schedule accurate callbacks via Tone Transport
                const eventId = Tone.getTransport().schedule((audioTime) => {
                    // Tie to animation frame via Draw.schedule
                    Tone.Draw.schedule(() => {
                        onSpawn(note);
                    }, audioTime);
                }, spawnTime);
                this.events.push(eventId);
            }
        });
    }

    public clear(): void {
        this.events.forEach(id => Tone.getTransport().clear(id));
        this.events = [];
    }
}
