import { useGameStore } from '../shared/stores/gameStore'
import { SongUploadScreen } from '../features/song-upload/SongUploadScreen'
import { AnalyzingScreen } from '../features/beat-analysis/AnalyzingScreen'
import { GameplayScreen } from '../features/gameplay/GameplayScreen'
import { ResultsScreen } from '../features/results/ResultsScreen'
import { Layout } from '../features/shared-ui/Layout'
import { Button } from '@/components/ui/button'

export function AppRouter() {
    const phase = useGameStore((state) => state.phase)
    const mode = useGameStore((state) => state.mode)
    const difficulty = useGameStore((state) => state.difficulty)
    const setPhase = useGameStore((state) => state.setPhase)

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
                        <p className="text-slate-300">
                            {mode === 'trackpad' ? 'Trackpad Only: tap/click or press any lane key.' : 'Classic: use D / F / J / K.'}
                        </p>
                        <p className="text-slate-400 uppercase tracking-wider">Difficulty: {difficulty}</p>
                        <Button size="lg" onClick={() => setPhase('countdown')} className="bg-neon-cyan hover:bg-neon-cyan/80 text-black">
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
