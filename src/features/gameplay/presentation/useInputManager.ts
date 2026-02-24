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
            if (!engine) return;

            const key = e.key.toLowerCase();

            // Handle pause toggle
            if (key === 'escape' && (isPlaying || useGameStore.getState().phase === 'paused')) {
                e.preventDefault();
                if (isPlaying) {
                    engine.pause();
                } else if (useGameStore.getState().phase === 'paused') {
                    // Let UI handle the resume countdown later, but trigger it here if needed
                    // Actually, let's just trigger pause for now, resume is better handled by UI buttons
                    // to prevent accidental resumes from button mashing.
                    // But we can support Escape to resume if we want:
                    useGameStore.getState().setPhase('countdown');
                }
                return;
            }

            if (!isPlaying) return;

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

    const handleKeyUp = useCallback(
        (e: KeyboardEvent) => {
            if (!engine || !isPlaying) return;
            const key = e.key.toLowerCase();
            const trackpadMode = mode === 'trackpad';
            const lane = trackpadMode ? (key === ' ' ? 0 : undefined) : KEY_BINDINGS[key];

            if (lane !== undefined) {
                e.preventDefault();
                // We assume engine has a handleInputUp, but let's check conditionally just in case
                if ((engine as any).handleInputUp) {
                    (engine as any).handleInputUp(lane, Tone.getTransport().seconds);
                }
                window.dispatchEvent(new CustomEvent('lane-release', { detail: { lane } }));
            }
        },
        [engine, isPlaying, mode]
    );

    const handleTouchStart = useCallback(
        (e: TouchEvent) => {
            if (!isPlaying || !engine) return;

            // Prevent default browser behavior (e.g. scrolling/zooming)
            if (e.cancelable) {
                e.preventDefault();
            }

            const trackpadMode = mode === 'trackpad';

            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                let lane: 0 | 1 | 2 | 3 | undefined = undefined;

                if (trackpadMode) {
                    lane = 0;
                } else {
                    const screenWidth = window.innerWidth;
                    const laneWidth = screenWidth / 4;
                    // Map touch X coordinate to lane 0-3
                    lane = Math.floor(touch.clientX / laneWidth) as 0 | 1 | 2 | 3;
                    if (lane < 0) lane = 0;
                    if (lane > 3) lane = 3;
                }

                if (lane !== undefined) {
                    engine.handleInput(lane, Tone.getTransport().seconds);
                    window.dispatchEvent(new CustomEvent('lane-hit', { detail: { lane } }));

                    if (navigator.vibrate) {
                        navigator.vibrate(10); // Haptic feedback on touch
                    }
                }
            }
        },
        [engine, isPlaying, mode]
    );

    const handleTouchEnd = useCallback(
        (e: TouchEvent) => {
            if (!isPlaying || !engine) return;

            if (e.cancelable) {
                e.preventDefault();
            }

            const trackpadMode = mode === 'trackpad';

            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                let lane: 0 | 1 | 2 | 3 | undefined = undefined;

                if (trackpadMode) {
                    lane = 0;
                } else {
                    const screenWidth = window.innerWidth;
                    const laneWidth = screenWidth / 4;
                    lane = Math.floor(touch.clientX / laneWidth) as 0 | 1 | 2 | 3;
                    if (lane < 0) lane = 0;
                    if (lane > 3) lane = 3;
                }

                if (lane !== undefined) {
                    if ((engine as any).handleInputUp) {
                        (engine as any).handleInputUp(lane, Tone.getTransport().seconds);
                    }
                    window.dispatchEvent(new CustomEvent('lane-release', { detail: { lane } }));
                }
            }
        },
        [engine, isPlaying, mode]
    );

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('touchstart', handleTouchStart, { passive: false });
        window.addEventListener('touchend', handleTouchEnd, { passive: false });
        window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [handleKeyDown, handleKeyUp, handleTouchStart, handleTouchEnd]);
}
