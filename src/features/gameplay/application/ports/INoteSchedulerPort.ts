import { Note } from '@/features/gameplay/domain/types';

export interface INoteSchedulerPort {
    scheduleAll(notes: Note[], onSpawn: (note: Note) => void): void;
    clear(): void;
}
