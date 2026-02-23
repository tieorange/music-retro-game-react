export const TIMING_WINDOWS = {
    perfect: 30,   // ±ms
    great: 70,
    good: 120,
} as const;

export const COMBO_THRESHOLDS = [
    { combo: 0, multiplier: 1 },
    { combo: 10, multiplier: 2 },
    { combo: 30, multiplier: 4 },
    { combo: 50, multiplier: 8 },
] as const;

export const SCORE_VALUES = {
    perfect: 300,
    great: 200,
    good: 100,
    miss: 0,
} as const;

export const GRADE_THRESHOLDS = {
    S: 95,  // accuracy %
    A: 85,
    B: 70,
    C: 0,
} as const;

export const LANE_COUNT = 4;
export const NOTE_FALL_DURATION = 2.0;  // seconds
export const LANE_KEYS = ['d', 'f', 'j', 'k'] as const;
