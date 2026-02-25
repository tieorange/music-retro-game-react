import { useGameStore } from './gameStore';
import { logInfo, resetFlowId, setGameSnapshot } from '@/core/logging';

/**
 * Subscribe to Zustand store phase transitions and forward them to the logger.
 * This bridge module keeps gameStore.ts free of any logging dependency.
 * Call once from main.tsx after both store and logger are initialized.
 */
export function initGameStoreLogger(): void {
    useGameStore.subscribe((state, prevState) => {
        if (state.phase !== prevState.phase) {
            logInfo('app.phase.changed', {
                from: prevState.phase,
                to: state.phase,
            });
            setGameSnapshot({ phase: state.phase });

            // Start a clean slate when returning to idle (new upload cycle)
            if (state.phase === 'idle' && prevState.phase !== 'idle') {
                resetFlowId();
            }
        }
    });
}
