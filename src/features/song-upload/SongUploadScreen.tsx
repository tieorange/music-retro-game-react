import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { useGameStore } from '../../shared/stores/gameStore';
import { useAudioDecoder } from './useAudioDecoder';
import { DropZone } from './DropZone';
import { Button } from '@/components/ui/button';
import { Layout } from '../shared-ui/Layout';
import { nanoid } from 'nanoid';

export function SongUploadScreen() {
    const setSong = useGameStore((state) => state.setSong);
    const setPhase = useGameStore((state) => state.setPhase);
    const mode = useGameStore((state) => state.mode);
    const setMode = useGameStore((state) => state.setMode);
    const difficulty = useGameStore((state) => state.difficulty);
    const setDifficulty = useGameStore((state) => state.setDifficulty);
    const { isDecoding, error, decode } = useAudioDecoder();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileAccepted = (file: File) => {
        setSelectedFile(file);
    };

    const handleProceed = async () => {
        if (!selectedFile) return;

        const audioBuffer = await decode(selectedFile);

        if (audioBuffer) {
            setSong({
                id: nanoid(),
                name: selectedFile.name.replace(/\.[^/.]+$/, ""), // remove extension
                file: selectedFile,
                audioBuffer,
                duration: audioBuffer.duration,
            });
            setPhase('analyzing');
        }
    };

    return (
        <Layout>
            <motion.div
                className="flex flex-col items-center justify-center space-y-8 max-w-2xl w-full"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="text-center space-y-4">
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-yellow drop-shadow-[0_0_15px_rgba(255,0,255,0.8)]">
                        PIXELBEAT
                    </h1>
                    <p className="text-xl text-slate-300">Synthwave Rhythm Action</p>
                </div>

                <DropZone onFileAccepted={handleFileAccepted} />

                <div className="w-full grid grid-cols-2 gap-3">
                    <Button
                        type="button"
                        onClick={() => setMode('classic')}
                        className={mode === 'classic'
                            ? 'bg-neon-cyan text-black'
                            : 'bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700'}
                    >
                        CLASSIC (D/F/J/K)
                    </Button>
                    <Button
                        type="button"
                        onClick={() => setMode('trackpad')}
                        className={mode === 'trackpad'
                            ? 'bg-neon-green text-black'
                            : 'bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700'}
                    >
                        TRACKPAD ONLY (1 BUTTON)
                    </Button>
                </div>

                <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Button
                        type="button"
                        onClick={() => setDifficulty('easy')}
                        className={difficulty === 'easy'
                            ? 'bg-neon-green text-black'
                            : 'bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700'}
                    >
                        EASY
                    </Button>
                    <Button
                        type="button"
                        onClick={() => setDifficulty('normal')}
                        className={difficulty === 'normal'
                            ? 'bg-neon-cyan text-black'
                            : 'bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700'}
                    >
                        NORMAL
                    </Button>
                    <Button
                        type="button"
                        onClick={() => setDifficulty('hard')}
                        className={difficulty === 'hard'
                            ? 'bg-neon-magenta text-black'
                            : 'bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700'}
                    >
                        HARD
                    </Button>
                    <Button
                        type="button"
                        onClick={() => setDifficulty('expert')}
                        className={difficulty === 'expert'
                            ? 'bg-neon-yellow text-black'
                            : 'bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700'}
                    >
                        EXPERT
                    </Button>
                </div>

                {error && (
                    <div className="text-red-500 bg-red-950/50 p-4 rounded-md border border-red-500/50 w-full text-center">
                        {error}
                    </div>
                )}

                {selectedFile && !error && (
                    <motion.div
                        className="flex flex-col items-center space-y-6 w-full"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                    >
                        <div className="bg-slate-800/80 p-4 rounded-lg border border-neon-green/50 w-full text-center shadow-[0_0_15px_rgba(0,255,0,0.2)]">
                            <p className="text-neon-green truncate" title={selectedFile.name}>
                                {selectedFile.name}
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
