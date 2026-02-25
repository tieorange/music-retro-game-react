import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { logInfo } from '@/core/logging';
import { GameState, GamePhase, HitResult, GameMode, GameDifficulty } from '@/features/gameplay/domain/types';
import { Song } from '@/features/audio/domain/types';
import { BeatMap } from '@/features/analysis/domain/types';
import { GameScore } from '@/features/scoring/domain/types';

interface GameActions {
    setPhase: (phase: GamePhase) => void;
    setMode: (mode: GameMode) => void;
    setDifficulty: (difficulty: GameDifficulty) => void;
    setSong: (song: Song) => void;
    setBeatMap: (beatMap: BeatMap) => void;
    setCurrentTime: (time: number) => void;
    updateScoreAndCombo: (score: number, combo: number, multiplier: number) => void;
    addHitResult: (result: HitResult) => void;
    setFinalScore: (score: GameScore) => void;
    setHighScores: (scores: GameScore[]) => void;
    setMusicVolume: (db: number) => void;
    setSfxVolume: (db: number) => void;
    setMasterVolume: (db: number) => void;
    clearAudioBuffer: () => void;
    reset: () => void;
}

export type GameStore = GameState & GameActions;

const initialState: GameState = {
    phase: 'idle',
    mode: 'trackpad',
    difficulty: 'easy',
    song: null,
    beatMap: null,
    currentTime: 0,
    combo: 0,
    multiplier: 1,
    score: 0,
    hitResults: [],
    finalScore: null,
    highScores: [],
    musicVolume: -6,
    sfxVolume: -8,
    masterVolume: 0,
};

export const useGameStore = create<GameStore>()(
    persist(
        (set) => ({
            ...initialState,

            setPhase: (phase) => {
                logInfo('app.phase.changed', { to: phase, from: useGameStore.getState().phase });
                set({ phase });
            },
            setMode: (mode) => {
                logInfo('app.mode.changed', { mode });
                set({ mode });
            },
            setDifficulty: (difficulty) => {
                logInfo('app.difficulty.changed', { difficulty });
                set({ difficulty });
            },

            setSong: (song) => {
                logInfo('app.song.selected', { songId: song.id, title: song.name });
                set({ song });
            },

            setBeatMap: (beatMap) => {
                logInfo('app.beatmap.set', { bpm: beatMap.bpm, noteCount: beatMap.notes.length });
                set({ beatMap });
            },

            setCurrentTime: (currentTime) => set({ currentTime }),

            updateScoreAndCombo: (score, combo, multiplier) => set({ score, combo, multiplier }),

            addHitResult: (result) => set((state) => ({
                hitResults: [...state.hitResults, result]
            })),

            setFinalScore: (finalScore) => set({ finalScore }),

            setHighScores: (highScores) => set({ highScores }),

            clearAudioBuffer: () => {
                logInfo('app.audiobuffer.cleared', {});
                set((state) => ({
                    song: state.song ? { ...state.song, audioBuffer: null } : null,
                }));
            },

            setMusicVolume: (musicVolume) => set({ musicVolume }),
            setSfxVolume: (sfxVolume) => set({ sfxVolume }),
            setMasterVolume: (masterVolume) => set({ masterVolume }),

            reset: () => {
                logInfo('app.state.reset', {});
                set((state) => ({
                    ...initialState,
                    mode: state.mode, // Preserve settings
                    difficulty: state.difficulty,
                    musicVolume: state.musicVolume,
                    sfxVolume: state.sfxVolume,
                    masterVolume: state.masterVolume,
                    highScores: state.highScores, // Preserve high scores
                }));
            },
        }),
        {
            name: 'pixelbeat-storage',
            partialize: (state) => ({
                mode: state.mode,
                difficulty: state.difficulty,
                musicVolume: state.musicVolume,
                sfxVolume: state.sfxVolume,
                masterVolume: state.masterVolume,
                highScores: state.highScores,
            }),
        }
    )
);
