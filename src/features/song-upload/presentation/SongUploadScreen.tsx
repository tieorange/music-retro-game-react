import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { useGameStore } from '@/state/gameStore';
import { useAudioDecoder } from '@/features/audio/presentation/useAudioDecoder';
import { DropZone } from './DropZone';
import { BuiltInSongPicker } from './BuiltInSongPicker';
import { type BuiltInSong } from '../data/builtInSongs';
import { Button } from '@/core/ui/button';
import { Layout } from '@/core/ui/Layout';
import { nanoid } from 'nanoid';
import { YouTubeImportPanel } from './YouTubeImportPanel';

export function SongUploadScreen() {
    const setSong = useGameStore((state) => state.setSong);
    const setPhase = useGameStore((state) => state.setPhase);
    const mode = useGameStore((state) => state.mode);
    const setMode = useGameStore((state) => state.setMode);
    const difficulty = useGameStore((state) => state.difficulty);
    const setDifficulty = useGameStore((state) => state.setDifficulty);
    const { isDecoding, error, decode, decodeUrl } = useAudioDecoder();

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedBuiltIn, setSelectedBuiltIn] = useState<BuiltInSong | null>(null);

    const handleFileAccepted = (file: File) => {
        setSelectedFile(file);
        setSelectedBuiltIn(null);
    };

    const handleBuiltInSelected = (song: BuiltInSong) => {
        setSelectedBuiltIn(song);
        setSelectedFile(null);
    };

    const handleProceed = async () => {
        if (selectedBuiltIn) {
            const audioBuffer = await decodeUrl(selectedBuiltIn.url, selectedBuiltIn.name);
            if (audioBuffer) {
                setSong({
                    id: nanoid(),
                    name: selectedBuiltIn.name,
                    sourceType: 'builtin',
                    file: null,
                    audioBuffer,
                    duration: audioBuffer.duration,
                });
                setPhase('analyzing');
            }
            return;
        }

        if (selectedFile) {
            const audioBuffer = await decode(selectedFile);
            if (audioBuffer) {
                setSong({
                    id: nanoid(),
                    name: selectedFile.name.replace(/\.[^/.]+$/, ''),
                    sourceType: 'upload',
                    file: selectedFile,
                    audioBuffer,
                    duration: audioBuffer.duration,
                });
                setPhase('analyzing');
            }
        }
    };

    const handleYoutubeImportComplete = async (audioUrl: string, title: string) => {
        const audioBuffer = await decodeUrl(audioUrl, title);
        if (audioBuffer) {
            setSong({
                id: nanoid(),
                name: title,
                sourceType: 'youtube',
                file: null,
                sourceUrl: audioUrl,
                audioBuffer,
                duration: audioBuffer.duration,
            });
            setPhase('analyzing');
        }
    };

    const selectedName = selectedBuiltIn?.name ?? selectedFile?.name ?? null;
    const hasSelection = selectedBuiltIn !== null || selectedFile !== null;

    return (
        <Layout>
            {/* Animated Background Grid */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-20">
                <div
                    className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.3)_1px,transparent_1px)] bg-[size:50px_50px]"
                    style={{
                        transform: 'perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px)',
                        animation: 'grid-move 10s linear infinite',
                    }}
                />
            </div>
            <style>{`
                @keyframes grid-move {
                    0% { background-position: 0px 0px; }
                    100% { background-position: 0px 50px; }
                }
            `}</style>

            <motion.div
                className="flex flex-col items-center justify-center space-y-4 sm:space-y-6 max-w-2xl w-full py-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="text-center space-y-2 relative z-10">
                    <motion.h1
                        className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan via-white to-neon-magenta drop-shadow-[0_0_20px_rgba(255,0,255,0.8)] leading-tight"
                        animate={{ opacity: [1, 0.8, 1, 0.5, 1] }}
                        transition={{ repeat: Infinity, duration: 4, times: [0, 0.1, 0.2, 0.3, 1] }}
                    >
                        PIXELBEAT
                    </motion.h1>
                    <p className="text-sm sm:text-xl text-slate-300">Synthwave Rhythm Action</p>
                </div>

                <DropZone onFileAccepted={handleFileAccepted} />

                <div className="w-full relative z-10">
                    <YouTubeImportPanel onImportComplete={handleYoutubeImportComplete} />
                </div>

                <BuiltInSongPicker selected={selectedBuiltIn} onSelect={handleBuiltInSelected} />

                <div className="w-full grid grid-cols-2 gap-4 relative z-10">
                    <Button
                        type="button"
                        onClick={() => setMode('classic')}
                        className={mode === 'classic'
                            ? 'bg-neon-cyan text-black border-b-4 border-r-4 border-cyan-800 scale-105 font-bold shadow-[0_0_15px_rgba(0,255,255,0.6)]'
                            : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-800 hover:text-white transition-all'}
                    >
                        CLASSIC<br /><span className="text-xs opacity-70">(D/F/J/K)</span>
                    </Button>
                    <Button
                        type="button"
                        onClick={() => setMode('trackpad')}
                        className={mode === 'trackpad'
                            ? 'bg-neon-green text-black border-b-4 border-r-4 border-green-800 scale-105 font-bold shadow-[0_0_15px_rgba(0,255,0,0.6)]'
                            : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-800 hover:text-white transition-all'}
                    >
                        TRACKPAD<br /><span className="text-xs opacity-70">(SPACEBAR)</span>
                    </Button>
                </div>

                <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
                    <Button
                        type="button"
                        onClick={() => setDifficulty('easy')}
                        className={difficulty === 'easy'
                            ? 'bg-neon-green text-black font-bold shadow-[0_0_10px_rgba(0,255,0,0.5)]'
                            : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-800 transition-all'}
                    >
                        EASY
                    </Button>
                    <Button
                        type="button"
                        onClick={() => setDifficulty('normal')}
                        className={difficulty === 'normal'
                            ? 'bg-neon-cyan text-black font-bold shadow-[0_0_10px_rgba(0,255,255,0.5)]'
                            : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-800 transition-all'}
                    >
                        NORMAL
                    </Button>
                    <Button
                        type="button"
                        onClick={() => setDifficulty('hard')}
                        className={difficulty === 'hard'
                            ? 'bg-neon-magenta text-black font-bold shadow-[0_0_10px_rgba(255,0,255,0.5)]'
                            : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-800 transition-all'}
                    >
                        HARD
                    </Button>
                    <Button
                        type="button"
                        onClick={() => setDifficulty('expert')}
                        className={difficulty === 'expert'
                            ? 'bg-neon-yellow text-black font-bold shadow-[0_0_10px_rgba(255,255,0,0.5)]'
                            : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-800 transition-all'}
                    >
                        EXPERT
                    </Button>
                </div>

                {error && (
                    <div className="text-red-500 bg-red-950/50 p-4 rounded-md border border-red-500/50 w-full text-center">
                        {error}
                    </div>
                )}

                {hasSelection && !error && (
                    <motion.div
                        className="flex flex-col items-center space-y-6 w-full pb-8 sm:pb-0"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                    >
                        <div className="bg-slate-800/80 p-4 rounded-lg border border-neon-green/50 w-full text-center shadow-[0_0_15px_rgba(0,255,0,0.2)]">
                            <p className="text-neon-green truncate" title={selectedName ?? ''}>
                                {selectedName}
                            </p>
                        </div>

                        <Button
                            size="lg"
                            onClick={handleProceed}
                            disabled={isDecoding}
                            className="bg-neon-magenta hover:bg-neon-magenta/80 text-white font-bold text-lg px-8 py-6 rounded-none border-b-4 border-r-4 border-purple-950 active:border-0 active:translate-y-1 active:translate-x-1 transition-all"
                        >
                            {isDecoding ? (
                                <span className="flex items-center space-x-2">
                                    <span className="animate-pulse">DECODING...</span>
                                </span>
                            ) : (
                                <span className="flex items-center space-x-2">
                                    <Play className="w-5 h-5 fill-current" />
                                    <span>START ANALYSIS</span>
                                </span>
                            )}
                        </Button>
                    </motion.div>
                )}
            </motion.div>
        </Layout>
    );
}
