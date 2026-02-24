import { useEffect, useState } from 'react';
import { Layout } from '@/core/ui/Layout';
import { usePixiApp } from '@/core/lib/usePixiApp';
import { useGameEngine } from './useGameEngine';
import { GameScene } from './scene/GameScene';
import { useInputManager } from './useInputManager';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/state/gameStore';
import * as Tone from 'tone';
import { RotateCcw, Pause, Play, RefreshCw, LogOut } from 'lucide-react';

export function GameplayScreen() {
    const { containerRef, app } = usePixiApp();
    const engine = useGameEngine();
    const phase = useGameStore(s => s.phase);
    const setPhase = useGameStore(s => s.setPhase);

    const [countdown, setCountdown] = useState<number | 'GO!' | null>(null);
    const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
    const [isPortrait, setIsPortrait] = useState(false);

    useInputManager(engine);

    useEffect(() => {
        // Fullscreen API attempt
        if (phase === 'countdown') {
            const el = document.documentElement as any;
            const requestFullscreen = el.requestFullscreen || el.webkitRequestFullscreen;
            if (requestFullscreen) {
                requestFullscreen.call(el).catch(() => {
                    // Ignore fullscreen rejection (common if not user-initiated immediately)
                });
            }
        }
    }, [phase]);

    useEffect(() => {
        const checkOrientation = () => {
            // Some mobile browsers return innerHeight > innerWidth for portrait
            // We only care if playing on mobile
            if (window.innerWidth < 1024) {
                setIsPortrait(window.innerHeight > window.innerWidth);
            } else {
                setIsPortrait(false);
            }
        };

        checkOrientation();
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', checkOrientation);
        return () => {
            window.removeEventListener('resize', checkOrientation);
            window.removeEventListener('orientationchange', checkOrientation);
        };
    }, []);

    useEffect(() => {
        if (phase === 'countdown') {
            setCountdown(3);

            // Audio unlock fallback check
            if (Tone.context.state !== 'running') {
                setNeedsAudioUnlock(true);
            }

            const timer3 = setTimeout(() => setCountdown(2), 700);
            const timer2 = setTimeout(() => setCountdown(1), 1400);
            const timer1 = setTimeout(() => setCountdown('GO!'), 2100);
            const timerGo = setTimeout(() => {
                setCountdown(null);
                setPhase('playing');
            }, 2800);

            return () => {
                clearTimeout(timer3);
                clearTimeout(timer2);
                clearTimeout(timer1);
                clearTimeout(timerGo);
            };
        }
    }, [phase, setPhase]);

    const mode = useGameStore(s => s.mode);

    useEffect(() => {
        if (!app || !engine) return;

        // Create scene early to see visuals during countdown
        const scene = new GameScene(app, engine, mode);
        app.stage.addChild(scene);

        return () => {
            app.stage.removeChild(scene);
            scene.destroy(true);
        };
    }, [app, engine]);

    const handleAudioUnlock = async () => {
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        setNeedsAudioUnlock(false);
    };

    const handlePause = () => {
        if (engine && phase === 'playing') {
            engine.pause();
        }
    };

    const handleResume = () => {
        setPhase('countdown');
    };

    const handleRetry = () => {
        if (engine) engine.retry();
    };

    const handleQuit = () => {
        if (engine) {
            engine.endGame();
            // End game goes to results, but if they quit, we might just want to go idle
            setPhase('idle');
        } else {
            setPhase('idle');
        }
    };

    // Color logic
    let colorClass = 'text-white';
    if (countdown === 3) colorClass = 'text-red-500 drop-shadow-[0_0_20px_rgba(255,0,0,0.8)]';
    if (countdown === 2) colorClass = 'text-yellow-500 drop-shadow-[0_0_20px_rgba(255,255,0,0.8)]';
    if (countdown === 1) colorClass = 'text-green-500 drop-shadow-[0_0_20px_rgba(0,255,0,0.8)]';
    if (countdown === 'GO!') colorClass = 'text-neon-cyan drop-shadow-[0_0_30px_rgba(0,255,255,0.8)]';

    return (
        <Layout>
            <div className="relative w-full h-full flex items-center justify-center">
                {/* The PIXI Canvas */}
                <div ref={containerRef} className="absolute inset-0 w-full h-full rounded-md overflow-hidden bg-black shadow-[0_0_30px_rgba(0,255,255,0.2)]" />

                {/* Pause Button in Top Right */}
                <AnimatePresence>
                    {phase === 'playing' && (
                        <motion.button
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="absolute top-4 right-4 z-40 p-3 bg-black/50 border border-neon-cyan/50 rounded-full text-neon-cyan hover:bg-neon-cyan/20 hover:scale-110 hover:shadow-[0_0_15px_rgba(0,255,255,0.6)] transition-all cursor-pointer backdrop-blur-md"
                            onClick={handlePause}
                        >
                            <Pause className="w-6 h-6" />
                        </motion.button>
                    )}
                </AnimatePresence>

                {/* Countdown Overlay */}
                <AnimatePresence>
                    {countdown && (
                        <motion.div
                            key={countdown}
                            initial={{ scale: 2.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ type: 'spring', bounce: 0.6, duration: 0.5 }}
                            className={`absolute font-bold text-8xl md:text-9xl z-50 pointer-events-none ${colorClass}`}
                            style={{ fontFamily: '"Press Start 2P", monospace' }}
                        >
                            {countdown}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Screen Flash on Beat (Optional polish depending on phase) */}
                <AnimatePresence>
                    {countdown === 'GO!' && (
                        <motion.div
                            className="absolute inset-0 bg-white pointer-events-none z-40"
                            initial={{ opacity: 0.8 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                    )}
                </AnimatePresence>

                {/* Audio Fallback Overlay */}
                <AnimatePresence>
                    {needsAudioUnlock && (
                        <motion.div
                            className="absolute inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm p-4 cursor-pointer text-center"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={handleAudioUnlock}
                            onTouchStart={handleAudioUnlock}
                        >
                            <h3 className="text-2xl text-neon-yellow mb-2">Audio Blocked</h3>
                            <p className="text-white text-lg animate-pulse">Tap anywhere to enable sound</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Pause Overlay */}
                <AnimatePresence>
                    {phase === 'paused' && (
                        <motion.div
                            className="absolute inset-0 z-[60] bg-black/70 flex flex-col items-center justify-center backdrop-blur-md"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        >
                            <h2 className="text-4xl md:text-5xl font-bold text-neon-magenta mb-8 drop-shadow-[0_0_15px_rgba(255,0,255,0.8)]" style={{ fontFamily: '"Press Start 2P", monospace' }}>
                                PAUSED
                            </h2>
                            <div className="flex flex-col gap-4 w-64">
                                <button
                                    className="flex items-center justify-center gap-3 w-full py-4 bg-neon-cyan/20 border-2 border-neon-cyan text-neon-cyan font-bold hover:bg-neon-cyan hover:text-black hover:shadow-[0_0_20px_rgba(0,255,255,0.8)] transition-all rounded"
                                    onClick={handleResume}
                                >
                                    <Play className="w-5 h-5" /> RESUME
                                </button>
                                <button
                                    className="flex items-center justify-center gap-3 w-full py-4 bg-neon-yellow/20 border-2 border-neon-yellow text-neon-yellow font-bold hover:bg-neon-yellow hover:text-black hover:shadow-[0_0_20px_rgba(255,255,0,0.8)] transition-all rounded"
                                    onClick={handleRetry}
                                >
                                    <RefreshCw className="w-5 h-5" /> RETRY
                                </button>
                                <button
                                    className="flex items-center justify-center gap-3 w-full py-4 bg-red-500/20 border-2 border-red-500 text-red-500 font-bold hover:bg-red-500 hover:text-black hover:shadow-[0_0_20px_rgba(255,0,0,0.8)] transition-all rounded"
                                    onClick={handleQuit}
                                >
                                    <LogOut className="w-5 h-5" /> QUIT
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Portrait Overlay */}
                <AnimatePresence>
                    {isPortrait && (
                        <motion.div
                            className="absolute inset-0 z-[70] bg-black flex flex-col items-center justify-center space-y-4 p-6 text-center"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        >
                            <RotateCcw className="w-16 h-16 text-neon-cyan animate-spin-slow" />
                            <h2 className="text-2xl font-bold text-white">Rotate Device</h2>
                            <p className="text-gray-400">PixelBeat is best played in landscape mode.</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Layout>
    );
}
