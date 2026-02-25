export interface BuiltInSong {
    name: string;
    url: string;
}

const BASE = import.meta.env.BASE_URL;

interface ManifestEntry {
    name: string;
    file: string;
}

export async function fetchBuiltInSongs(): Promise<BuiltInSong[]> {
    try {
        const res = await fetch(`${BASE}music/manifest.json`);
        if (!res.ok) return [];
        const manifest: ManifestEntry[] = await res.json();
        return manifest.map(entry => ({
            name: entry.name,
            url: `${BASE}music/${encodeURIComponent(entry.file)}`,
        }));
    } catch {
        return [];
    }
}
