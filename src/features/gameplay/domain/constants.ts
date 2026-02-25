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
    { combo: 100, multiplier: 16 }, // FEVER
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

export const NEAR_MISS_WINDOW = 150; // ms

export const LANE_COLORS = [0x00ffff, 0xff00ff, 0xffff00, 0x00ff00];

export const JUDGMENT_COLORS = {
    perfect: 0xffd700, // gold
    great: 0x00ffff,   // cyan
    good: 0x00ff00,    // green
    miss: 0xff3333,    // red
    close: 0xff9900,   // orange
} as const;

export const HIT_ZONE_Y_RATIO = 0.85;
export const LANE_AREA_WIDTH_RATIO = 0.5;
export const TRACKPAD_LANE_AREA_RATIO = 0.2;
export const PORTRAIT_LANE_AREA_RATIO = 0.95;
export const PORTRAIT_TRACKPAD_LANE_AREA_RATIO = 0.6;
export const BLOOM_SPIKE_INITIAL = 0.5;
export const SHAKE_DURATION = 0.2;
export const SHAKE_INTENSITY = 8;
export const GLITCH_DURATION = 0.1;
export const END_GAME_BUFFER = 2.0;
