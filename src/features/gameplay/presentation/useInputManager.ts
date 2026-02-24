import { useEffect, useCallback } from 'react';
import { GameEngine } from '../application/GameEngine';
import { useGameStore } from '@/state/gameStore';
import * as Tone from 'tone';

const KEY_BINDINGS: Record<string, 0 | 1 | 2 | 3> = {
    'd': 0,
    'f': 1,
    'j': 2,
    'k': 3,
};

export function useInputManager(engine: GameEngine | null) {
    const isPlaying = useGameStore((state) => state.phase) === 'playing';
    const mode = useGameStore((state) => state.mode);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!isPlaying || !engine) return;

            const key = e.key.toLowerCase();
            const trackpadMode = mode === 'trackpad';

            // In trackpad mode (single lane), we now use Spacebar
            // In classic mode, we use the D/F/J/K keys
            const lane = trackpadMode
                ? (key === ' ' ? 0 : undefined)
                : KEY_BINDINGS[key];

            if (lane !== undefined) {
                // Prevent default browser behavior for these keys (like space jumping the page)
                e.preventDefault();

                // Pass the input to the game engine
                engine.handleInput(lane, Tone.getTransport().seconds);

                // Fire custom event for Pixi animation
                window.dispatchEvent(new CustomEvent('lane-hit', { detail: { lane } }));
            }
        },
        [engine, isPlaying, mode]
    );

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);
}
