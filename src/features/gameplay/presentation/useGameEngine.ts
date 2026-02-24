import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/state/gameStore';
import { GameEngine } from './engine/GameEngine';
import { AudioPlaybackService } from '@/features/audio/data/audioPlayback';

export function useGameEngine() {
    const phase = useGameStore(s => s.phase);
    const song = useGameStore(s => s.song);
    const beatMap = useGameStore(s => s.beatMap);

    const engineRef = useRef<GameEngine | null>(null);
    const [engine, setEngine] = useState<GameEngine | null>(null);

    useEffect(() => {
        let mounted = true;

        if ((phase === 'playing' || phase === 'countdown') && !engineRef.current && song && beatMap) {
            const playback = new AudioPlaybackService();

            const initialize = async () => {
                try {
                    await playback.load(song!.audioBuffer);

                    if (!mounted) {
                        playback.destroy();
                        return;
                    }

                    const localEngine = new GameEngine(beatMap!, playback, useGameStore.getState);
                    engineRef.current = localEngine;
                    setEngine(localEngine);
                } catch (error) {
                    console.error('Failed to initialize game engine:', error);
                    playback.destroy();
                    if (mounted) {
                        useGameStore.getState().setPhase('idle');
                    }
                }
            };

            initialize();
        }

        return () => {
            mounted = false;

            if (engineRef.current) {
                engineRef.current.destroy();
                engineRef.current = null;
                setEngine(null);
            }
        };
    }, [phase, song, beatMap]);

    useEffect(() => {
        if (phase === 'playing' && engine && !engine.isRunning) {
            engine.start().catch((err) => {
                if (err.message !== "disposed") {
                    console.error("Game engine failed to start", err);
                }
            });
        }
    }, [phase, engine]);

    return engine;
}
