import { Music2 } from 'lucide-react';
import { BUILT_IN_SONGS, type BuiltInSong } from '../data/builtInSongs';

interface Props {
    selected: BuiltInSong | null;
    onSelect: (song: BuiltInSong) => void;
}

export function BuiltInSongPicker({ selected, onSelect }: Props) {
    if (BUILT_IN_SONGS.length === 0) return null;

    return (
        <div className="w-full relative z-10">
            <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-slate-500 text-xs tracking-widest uppercase">or pick a track</span>
                <div className="flex-1 h-px bg-slate-700" />
            </div>

            <div className="flex flex-col gap-2">
                {BUILT_IN_SONGS.map((song) => {
                    const isSelected = selected?.url === song.url;
                    return (
                        <button
                            key={song.url}
                            type="button"
                            onClick={() => onSelect(song)}
                            className={[
                                'flex items-center gap-3 w-full px-4 py-3 text-left transition-all',
                                'border font-mono text-sm truncate',
                                isSelected
                                    ? 'bg-neon-cyan/10 border-neon-cyan text-neon-cyan shadow-[0_0_12px_rgba(0,255,255,0.3)]'
                                    : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white hover:bg-slate-800/60',
                            ].join(' ')}
                        >
                            <Music2
                                className={`w-4 h-4 shrink-0 ${isSelected ? 'text-neon-cyan' : 'text-slate-500'}`}
                            />
                            <span className="truncate">{song.name}</span>
                            {isSelected && (
                                <span className="ml-auto shrink-0 text-xs text-neon-cyan">SELECTED</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
