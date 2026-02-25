/**
 * Built-in song library.
 *
 * To add a new track: drop an audio file into public/music/ and restart
 * the dev server. It will appear here automatically.
 *
 * Supported formats: mp3, ogg, wav, flac, m4a, aac
 */

export interface BuiltInSong {
    name: string;
    url: string;
}

// Vite discovers all audio files in public/music/ at build time.
// The returned URLs are correct for both dev and production (base-prefix included).
const modules = import.meta.glob('/public/music/*.{mp3,ogg,wav,flac,m4a,aac}');

export const BUILT_IN_SONGS: BuiltInSong[] = Object.keys(modules)
    .map((filePath) => ({
        name: filePath.split('/').pop()!.replace(/\.[^/.]+$/, ''),
        url: filePath.replace(/^\/public/, ''), // Convert /public/music/song.mp3 to /music/song.mp3
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
