import { create } from 'zustand';
import { GameState, GamePhase, Song, BeatMap, HitResult, GameScore, GameMode, GameDifficulty } from '../../domain/types';

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
    reset: () => void;
}

export type GameStore = GameState & GameActions;

const initialState: GameState = {
    phase: 'idle',
    mode: 'classic',
    difficulty: 'normal',
    song: null,
    beatMap: null,
    currentTime: 0,
    combo: 0,
    multiplier: 1,
    score: 0,
    hitResults: [],
    finalScore: null,
    highScores: [],
};

export const useGameStore = create<GameStore>((set) => ({
    ...initialState,

    setPhase: (phase) => set({ phase }),
    setMode: (mode) => set({ mode }),
    setDifficulty: (difficulty) => set({ difficulty }),

    setSong: (song) => set({ song }),

    setBeatMap: (beatMap) => set({ beatMap }),

    setCurrentTime: (currentTime) => set({ currentTime }),

    updateScoreAndCombo: (score, combo, multiplier) => set({ score, combo, multiplier }),

    addHitResult: (result) => set((state) => ({
        hitResults: [...state.hitResults, result]
    })),

    setFinalScore: (finalScore) => set({ finalScore }),

    setHighScores: (highScores) => set({ highScores }),

    reset: () => set((state) => ({
        ...initialState,
        highScores: state.highScores, // Preserve high scores across resets
    })),
}));
