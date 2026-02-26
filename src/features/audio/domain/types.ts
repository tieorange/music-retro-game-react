export type SongSourceType = 'upload' | 'builtin' | 'youtube';

export interface Song {
    id: string;              // hash of filename + size or job ID
    name: string;            // display name
    sourceType: SongSourceType;
    file: File | null;       // original file reference (null for remote)
    sourceUrl?: string;      // URL for remote songs
    licenseNote?: string;
    audioBuffer: AudioBuffer | null;
    duration: number;        // seconds
}
