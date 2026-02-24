import { useEffect, useState } from 'react';
import { Layout } from '@/core/ui/Layout';
import { usePixiApp } from '@/core/lib/usePixiApp';
import { useGameEngine } from './useGameEngine';
import { GameScene } from './scene/GameScene';
import { useInputManager } from './useInputManager';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/state/gameStore';

export function GameplayScreen() {
    const { containerRef, app } = usePixiApp();
    const engine = useGameEngine();
    const phase = useGameStore(s => s.phase);
    const setPhase = useGameStore(s => s.setPhase);

    const [countdown, setCountdown] = useState<number | 'GO!' | null>(null);

    useInputManager(engine);

    useEffect(() => {
        if (phase === 'countdown') {
            setCountdown(3);

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
            </div>
        </Layout>
    );
}
