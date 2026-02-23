import { BeatAnalysis, BeatMap, GameDifficulty, GameMode, Lane, Note } from '@/domain/types';
import { LANE_COUNT } from '@/domain/constants';
import { nanoid } from 'nanoid';

interface DifficultyConfig {
    baseStride: number;
    minGap: number;
    offbeatChance: number;
    allowTriplets: boolean;
    laneJumpChance: number;
}

const DIFFICULTY_CONFIG: Record<GameDifficulty, DifficultyConfig> = {
    easy: {
        baseStride: 2,
        minGap: 0.35,
        offbeatChance: 0,
        allowTriplets: false,
        laneJumpChance: 0.2,
    },
    normal: {
        baseStride: 1,
        minGap: 0.22,
        offbeatChance: 0.12,
        allowTriplets: false,
        laneJumpChance: 0.35,
    },
    hard: {
        baseStride: 1,
        minGap: 0.14,
        offbeatChance: 0.45,
        allowTriplets: false,
        laneJumpChance: 0.55,
    },
    expert: {
        baseStride: 1,
        minGap: 0.1,
        offbeatChance: 0.75,
        allowTriplets: true,
        laneJumpChance: 0.75,
    },
};

function seededValue(index: number, time: number) {
    return Math.abs(Math.sin(index * 12.9898 + time * 78.233));
}

function generateNoteTimes(beats: number[], difficulty: GameDifficulty): number[] {
    const cfg = DIFFICULTY_CONFIG[difficulty];
    if (beats.length === 0) return [];

    const candidates: number[] = [];

    for (let i = 0; i < beats.length; i += cfg.baseStride) {
        const beatTime = beats[i];
        const beatInBar = i % 4;
        const barIndex = Math.floor(i / 4);
        candidates.push(beatTime);

        const nextBeat = beats[i + 1];
        if (nextBeat === undefined) continue;

        const interval = nextBeat - beatTime;
        const stableInterval = interval > 0.22 && interval < 0.9;

        // Musical offbeat placement by bar position instead of random chance.
        if (stableInterval && cfg.offbeatChance > 0) {
            let addHalfBeat = false;
            if (difficulty === 'normal') {
                addHalfBeat = beatInBar === 1 && barIndex % 2 === 0;
            } else if (difficulty === 'hard') {
                addHalfBeat = beatInBar === 1 || beatInBar === 3;
            } else if (difficulty === 'expert') {
                addHalfBeat = true;
            }

            if (addHalfBeat) {
                candidates.push(beatTime + interval * 0.5);
            }
        }

        // Expert triplet-like fills at phrase ends.
        if (cfg.allowTriplets && stableInterval && interval > 0.36) {
            const phraseEnd = beatInBar === 3;
            const fillBar = barIndex % 2 === 1;
            if (phraseEnd && fillBar) {
                candidates.push(beatTime + interval / 3);
                candidates.push(beatTime + (2 * interval) / 3);
            }
        }
    }

    candidates.sort((a, b) => a - b);

    const filtered: number[] = [];
    for (const t of candidates) {
        if (filtered.length === 0 || t - filtered[filtered.length - 1] >= cfg.minGap) {
            filtered.push(t);
        }
    }

    return filtered;
}

export function generateBeatMap(
    songId: string,
    analysis: BeatAnalysis,
    mode: GameMode,
    difficulty: GameDifficulty
): BeatMap {
    const notes: Note[] = [];
    const noteTimes = generateNoteTimes(analysis.beats, difficulty);
    let previousLane = -1;
    let sameLaneCount = 0;
    const cfg = DIFFICULTY_CONFIG[difficulty];

    for (let i = 0; i < noteTimes.length; i++) {
        const time = noteTimes[i];
        if (mode === 'trackpad') {
            notes.push({
                id: nanoid(),
                time,
                lane: 0,
                type: 'normal',
            });
            continue;
        }

        // Lane selection: deterministic, but more lateral movement on higher difficulties.
        const seed = seededValue(i, time);
        let nextLane: Lane;

        if (previousLane < 0) {
            nextLane = Math.floor(seed * LANE_COUNT) as Lane;
        } else if (seed < cfg.laneJumpChance) {
            const shift = seed > 0.5 ? 1 : -1;
            nextLane = ((previousLane + shift + LANE_COUNT) % LANE_COUNT) as Lane;
        } else {
            nextLane = previousLane as Lane;
        }

        if (nextLane === previousLane) {
            sameLaneCount++;
            if (sameLaneCount >= 3) {
                nextLane = ((nextLane + 1) % LANE_COUNT) as Lane;
                sameLaneCount = 1;
            }
        } else {
            sameLaneCount = 1;
        }

        previousLane = nextLane;

        notes.push({
            id: nanoid(),
            time,
            lane: nextLane,
            type: 'normal',
        });
    }

    return {
        songId,
        bpm: analysis.bpm,
        notes,
    };
}
