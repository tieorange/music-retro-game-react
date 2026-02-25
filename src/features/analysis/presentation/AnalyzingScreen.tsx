import { motion } from 'framer-motion';
import { Layout } from '@/core/ui/Layout';
import { useBeatAnalysis } from './useBeatAnalysis';
import { Button } from '@/core/ui/button';
import { useGameStore } from '@/state/gameStore';
import { useEffect, useState, useRef } from 'react';

export function AnalyzingScreen() {
    const { progressPercent, progressStage, error } = useBeatAnalysis();
    const reset = useGameStore((state) => state.reset);

    // Store history of stages for the terminal effect
    const [logHistory, setLogHistory] = useState<string[]>([]);
    const terminalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (progressStage && !logHistory.includes(progressStage)) {
            setLogHistory(prev => [...prev.slice(-9), progressStage]); // Keep last 10
        }
    }, [progressStage]);

    // Auto-scroll terminal to bottom
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logHistory]);

    return (
        <Layout>
            <motion.div
                className="flex flex-col items-center justify-center space-y-8 w-full max-w-2xl px-4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                <h2 className="text-2xl md:text-3xl font-bold text-neon-cyan drop-shadow-[0_0_10px_rgba(0,255,255,0.8)] tracking-widest uppercase">
                    SYSTEM :: ANALYZING
                </h2>

                {/* Progress Bar Container */}
                <div className="w-full h-8 bg-slate-900 rounded border border-neon-cyan/50 overflow-hidden relative shadow-[0_0_15px_rgba(0,255,255,0.2)]">
                    <motion.div
                        className="h-full bg-neon-cyan/80"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ ease: "easeOut", duration: 0.2 }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-difference tracking-widest">
                        {Math.round(progressPercent)}%
                    </div>
                </div>

                {/* Retro Terminal Window */}
                <div
                    className="w-full h-48 bg-black/80 border-2 border-neon-green/30 rounded p-4 font-mono text-sm md:text-base overflow-hidden flex flex-col justify-end relative shadow-[inset_0_0_20px_rgba(0,255,0,0.1)]"
                    ref={terminalRef}
                >
                    {/* Scanline overlay */}
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-20"></div>

                    {error ? (
                        <div className="text-red-500 font-bold z-10">
                            <p className="mb-2">{'>'} CRITICAL ERROR ENCOUNTERED</p>
                            <p>{'>'} {error}</p>
                            <p className="mt-4 animate-pulse">{'>'} _</p>
                        </div>
                    ) : (
                        <div className="flex flex-col space-y-1 text-neon-green/80 z-10 w-full text-left">
                            {logHistory.map((log, i) => (
                                <motion.div
                                    key={log + i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={i === logHistory.length - 1 ? "text-neon-green font-bold drop-shadow-[0_0_5px_rgba(0,255,0,0.8)]" : ""}
                                >
                                    {'>'} {log}
                                    {i === logHistory.length - 1 && (
                                        <motion.span
                                            animate={{ opacity: [1, 0, 1] }}
                                            transition={{ repeat: Infinity, duration: 0.8 }}
                                            className="inline-block ml-1 w-2 h-4 bg-neon-green"
                                        />
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {error && (
                    <Button onClick={reset} className="bg-red-900 border-2 border-red-500 text-white font-bold hover:bg-red-800 rounded px-8 py-2 uppercase tracking-widest shadow-[0_0_20px_rgba(255,0,0,0.4)]">
                        REBOOT SYSTEM
                    </Button>
                )}
            </motion.div>
        </Layout >
    );
}
