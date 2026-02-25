import { Layout } from '@/core/ui/Layout';
import { useGameStore } from '@/state/gameStore';
import { Button } from '@/core/ui/button';
import { motion, animate } from 'framer-motion';
import { useEffect, useState } from 'react';

export function ResultsScreen() {
    const finalScore = useGameStore((state) => state.finalScore);
    const reset = useGameStore((state) => state.reset);

    if (!finalScore) {
        return (
            <Layout>
                <div className="text-center">
                    <h1 className="text-4xl text-red-500 mb-4">NO SCORE DATA RED</h1>
                    <Button onClick={reset} className="bg-red-900 border border-red-500 hover:bg-red-800 rounded-none px-6">
                        BACK TO MENU
                    </Button>
                </div>
            </Layout>
        );
    }

    // Calculate some fun stats
    const totalHits = finalScore.perfects + finalScore.greats + finalScore.goods;
    const hitPercentage = finalScore.totalNotes > 0 ? (totalHits / finalScore.totalNotes) * 100 : 0;

    // Confetti array (only generate if grade is S or A)
    const showConfetti = finalScore.grade === 'S' || finalScore.grade === 'A';
    const confettiColors = ['#ff00ff', '#00ffff', '#ffff00', '#00ff00'];
    const confettiParticles = showConfetti ? Array.from({ length: 50 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20, // Start above screen
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        delay: Math.random() * 2,
        duration: 2 + Math.random() * 3,
        scale: Math.random() * 0.5 + 0.5,
    })) : [];

    // Animated Score Count-Up
    const [displayScore, setDisplayScore] = useState(0);

    useEffect(() => {
        const controls = animate(0, finalScore.score, {
            duration: 1.5,
            ease: "easeOut",
            onUpdate(value) {
                setDisplayScore(Math.round(value));
            }
        });
        return controls.stop;
    }, [finalScore.score]);

    return (
        <Layout>
            <motion.div
                className="flex flex-col items-center justify-center space-y-8 w-full max-w-4xl"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
            >
                <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-neon-cyan to-neon-magenta drop-shadow-[0_0_20px_rgba(255,0,255,0.6)]">
                    STAGE CLEAR
                </h1>

                <div className="bg-slate-900/80 p-8 pt-10 border-2 border-neon-cyan/50 shadow-[0_0_30px_rgba(0,255,255,0.2)] rounded-lg w-full relative">

                    {/* Huge Grade Display */}
                    <motion.div
                        className="absolute -top-16 -right-8 w-32 h-32 md:w-48 md:h-48 flex items-center justify-center rounded-full border-4 border-neon-yellow shadow-[0_0_40px_rgba(255,255,0,0.5)] rotate-12 bg-slate-950/90 z-10"
                        initial={{ scale: 5, opacity: 0, rotate: -45 }}
                        animate={{ scale: 1, opacity: 1, rotate: 12 }}
                        transition={{ delay: 1.5, type: "spring", stiffness: 300, damping: 15 }}
                    >
                        <span className={`text-6xl md:text-9xl font-black ${finalScore.grade === 'S' ? 'text-neon-yellow drop-shadow-[0_0_20px_rgba(255,255,0,1)]' :
                            finalScore.grade === 'A' ? 'text-neon-green drop-shadow-[0_0_20px_rgba(0,255,0,1)]' :
                                finalScore.grade === 'B' ? 'text-neon-cyan drop-shadow-[0_0_20px_rgba(0,255,255,1)]' :
                                    'text-red-500 drop-shadow-[0_0_20px_rgba(255,0,0,1)]'
                            }`}>
                            {finalScore.grade}
                        </span>
                    </motion.div>

                    <h2 className="text-2xl text-neon-green mb-6 truncate pr-24">
                        {finalScore.songName}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="flex justify-between border-b border-slate-700 pb-2">
                                <span className="text-slate-400">SCORE</span>
                                <span className="text-3xl text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] tabular-nums">
                                    {displayScore.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-700 pb-2">
                                <span className="text-slate-400">MAX COMBO</span>
                                <span className="text-2xl text-neon-cyan">{finalScore.maxCombo}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-700 pb-2">
                                <span className="text-slate-400">ACCURACY</span>
                                <span className="text-2xl text-neon-green">{finalScore.accuracy.toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-700 pb-2">
                                <span className="text-slate-400">HIT RATE</span>
                                <span className="text-2xl text-neon-yellow">{hitPercentage.toFixed(2)}%</span>
                            </div>
                        </div>

                        <div className="space-y-3 bg-slate-950/50 p-4 rounded-md border border-slate-800">
                            <div className="flex justify-between">
                                <span className="text-neon-cyan">PERFECT</span>
                                <span className="text-white">{finalScore.perfects}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neon-green">GREAT</span>
                                <span className="text-white">{finalScore.greats}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neon-yellow">GOOD</span>
                                <span className="text-white">{finalScore.goods}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-red-500">MISS</span>
                                <span className="text-white">{finalScore.misses}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                >
                    <Button
                        size="lg"
                        onClick={reset}
                        className="bg-neon-magenta hover:bg-neon-magenta/80 text-white font-bold text-xl px-12 py-8 rounded-none border-b-4 border-r-4 border-purple-950 active:border-0 active:translate-y-1 active:translate-x-1 transition-all shadow-[0_0_20px_rgba(255,0,255,0.4)]"
                    >
                        PLAY NEXT TRACK
                    </Button>
                </motion.div>
            </motion.div>

            {showConfetti && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
                    {confettiParticles.map((particle) => (
                        <motion.div
                            key={particle.id}
                            className="absolute w-3 h-6"
                            style={{
                                backgroundColor: particle.color,
                                left: `${particle.x}%`,
                                top: `${particle.y}%`,
                                rotate: Math.random() * 360,
                            }}
                            initial={{ y: 0, rotateX: 0, rotateY: 0 }}
                            animate={{
                                y: '120vh',
                                rotateX: 360 * 2,
                                rotateY: 360 * 2,
                            }}
                            transition={{
                                duration: particle.duration,
                                delay: particle.delay + 1.5, // Start after grade appears
                                repeat: Infinity,
                                ease: "linear"
                            }}
                        />
                    ))}
                </div>
            )}
        </Layout>
    );
}
