import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../../shared/stores/gameStore';
import { GameEngine } from './GameEngine';
import { AudioPlaybackService } from '../../../infrastructure/audio/audioPlayback';

export function useGameEngine() {
    const store = useGameStore();
    const engineRef = useRef<GameEngine | null>(null);
    const [engine, setEngine] = useState<GameEngine | null>(null);

    useEffect(() => {
        let mounted = true;

        if (store.phase === 'playing' && !engineRef.current && store.song && store.beatMap) {
            const playback = new AudioPlaybackService();

            const initialize = async () => {
                try {
                    await playback.load(store.song!.audioBuffer);

                    if (!mounted) {
                        playback.destroy();
                        return;
                    }

                    const localEngine = new GameEngine(store.beatMap!, playback, useGameStore.getState);
                    engineRef.current = localEngine;
                    setEngine(localEngine);

                    await localEngine.start();
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
    }, [store.phase, store.song, store.beatMap]);

    return engine;
}
