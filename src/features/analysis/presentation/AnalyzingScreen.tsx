import { motion } from 'framer-motion';
import { Layout } from '@/core/ui/Layout';
import { useBeatAnalysis } from './useBeatAnalysis';
import { Button } from '@/core/ui/button';
import { useGameStore } from '@/state/gameStore';

export function AnalyzingScreen() {
    const { progressPercent, progressStage, error } = useBeatAnalysis();
    const reset = useGameStore((state) => state.reset);

    return (
        <Layout>
            <motion.div
                className="flex flex-col items-center justify-center space-y-8 w-full max-w-2xl"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                <h2 className="text-2xl md:text-4xl font-bold text-neon-cyan drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]">
                    ANALYZING TRACK
                </h2>

                {/* Progress Bar Container */}
                <div className="w-full h-8 bg-slate-800 rounded-full border border-slate-600 overflow-hidden relative shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                    <motion.div
                        className="h-full bg-gradient-to-r from-neon-magenta to-neon-yellow"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ ease: "easeOut", duration: 0.2 }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-difference">
                        {Math.round(progressPercent)}%
                    </div>
                </div>

                <div className="text-slate-300 text-center space-y-2 h-12">
                    {error ? (
                        <p className="text-red-500">{error}</p>
                    ) : (
                        <p className="animate-pulse">{progressStage}</p>
                    )}
                </div>

                {error && (
                    <Button onClick={reset} className="bg-red-900 border border-red-500 hover:bg-red-800 rounded-none px-6">
                        BACK TO MENU
                    </Button>
                )}
            </motion.div>
        </Layout>
    );
}
