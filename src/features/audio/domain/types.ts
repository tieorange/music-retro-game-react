export interface Song {
    id: string;              // hash of filename + size
    name: string;            // display name
    file: File;              // original file reference
    audioBuffer: AudioBuffer;
    duration: number;        // seconds
}
