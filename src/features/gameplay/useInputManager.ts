import { useEffect, useCallback } from 'react';
import { useGameStore } from '@/shared/stores/gameStore';
import { GameEngine } from './engine/GameEngine';
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
            const lane = trackpadMode
                ? (key === 'd' || key === 'f' || key === 'j' || key === 'k' || key === ' ' || key === 'enter' ? 0 : undefined)
                : KEY_BINDINGS[key];

            if (lane !== undefined) {
                // Prevent default browser behavior for these keys
                e.preventDefault();

                // Pass the input to the game engine
                engine.handleInput(lane, Tone.getTransport().seconds);

                // Optionally, fire a custom event to tell Pixi to animate the lane hit
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

    const handlePointerDown = useCallback(
        (e: PointerEvent) => {
            if (!isPlaying || !engine || mode !== 'trackpad') return;
            e.preventDefault();
            engine.handleInput(0, Tone.getTransport().seconds);
            window.dispatchEvent(new CustomEvent('lane-hit', { detail: { lane: 0 } }));
        },
        [engine, isPlaying, mode]
    );

    useEffect(() => {
        if (mode !== 'trackpad') return;
        window.addEventListener('pointerdown', handlePointerDown);
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [handlePointerDown, mode]);
}
