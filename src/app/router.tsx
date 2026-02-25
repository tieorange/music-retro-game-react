import { useGameStore } from '@/state/gameStore'
import { SongUploadScreen } from '@/features/song-upload/presentation/SongUploadScreen'
import { AnalyzingScreen } from '@/features/analysis/presentation/AnalyzingScreen'
import { GameplayScreen } from '@/features/gameplay/presentation/GameplayScreen'
import { ResultsScreen } from '@/features/scoring/presentation/ResultsScreen'
import { Layout } from '@/core/ui/Layout'
import { Button } from '@/core/ui/button'
import * as Tone from 'tone'

export function AppRouter() {
    const phase = useGameStore((state) => state.phase)
    const mode = useGameStore((state) => state.mode)
    const difficulty = useGameStore((state) => state.difficulty)
    const setPhase = useGameStore((state) => state.setPhase)

    const handlePlayNow = async () => {
        if (Tone.context.state !== 'running') {
            try {
                // Race Tone.start() against a timeout
                await Promise.race([
                    Tone.start(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Audio context start timeout')), 500))
                ]);
            } catch (error) {
                console.warn('Audio context start issue (continuing anyway):', error);
            }
        }
        setPhase('countdown')
    }

    switch (phase) {
        case 'idle':
            return <SongUploadScreen />
        case 'analyzing':
            return <AnalyzingScreen />
        case 'ready':
            return (
                <Layout>
                    <div className="flex flex-col items-center space-y-6">
                        <h2 className="text-4xl text-neon-green">READY</h2>
                        <p className="text-slate-300 text-center px-4">
                            {mode === 'trackpad' ? 'Trackpad Only: tap/click anywhere.' : 'Classic: tap lanes or use D / F / J / K.'}
                        </p>
                        <p className="text-slate-400 uppercase tracking-wider">Difficulty: {difficulty}</p>
                        <Button size="lg" onClick={handlePlayNow} className="bg-neon-cyan hover:bg-neon-cyan/80 text-black">
                            PLAY NOW
                        </Button>
                    </div>
                </Layout>
            )
        case 'countdown':
        case 'playing':
        case 'paused':
            return <GameplayScreen />
        case 'results':
            return <ResultsScreen />
        default:
            return <div>Unknown Phase</div>
    }
}
