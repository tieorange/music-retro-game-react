import { BeatAnalysis, BeatMap } from '@/features/analysis/domain/types';
import { GameDifficulty, GameMode, Lane, Note } from '@/features/gameplay/domain/types';
import { LANE_COUNT } from '@/features/gameplay/domain/constants';
import { nanoid } from 'nanoid';

interface DifficultyConfig {
    baseStride: number;
    minGap: number;
    offbeatChance: number;
    allowTriplets: boolean;
    laneJumpChance: number;
    strengthPercentile: number; // beats above this percentile are always included
}

const DIFFICULTY_CONFIG: Record<GameDifficulty, DifficultyConfig> = {
    easy: {
        baseStride: 2,
        minGap: 0.4,
        offbeatChance: 0,
        allowTriplets: false,
        laneJumpChance: 0.2,
        strengthPercentile: 75,
    },
    normal: {
        baseStride: 2,
        minGap: 0.28,
        offbeatChance: 0,
        allowTriplets: false,
        laneJumpChance: 0.3,
        strengthPercentile: 55,
    },
    hard: {
        baseStride: 1,
        minGap: 0.14,
        offbeatChance: 0.45,
        allowTriplets: false,
        laneJumpChance: 0.55,
        strengthPercentile: 25,
    },
    expert: {
        baseStride: 1,
        minGap: 0.1,
        offbeatChance: 0.75,
        allowTriplets: true,
        laneJumpChance: 0.75,
        strengthPercentile: 0,
    },
};

function seededValue(index: number, time: number) {
    return Math.abs(Math.sin(index * 12.9898 + time * 78.233));
}

function computePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[Math.min(index, sorted.length - 1)];
}

function generateNoteTimes(beats: number[], difficulty: GameDifficulty, beatStrengths?: number[]): number[] {
    const cfg = DIFFICULTY_CONFIG[difficulty];
    if (beats.length === 0) return [];

    const hasStrengths = beatStrengths !== undefined && beatStrengths.length === beats.length;
    const strengthThreshold = hasStrengths
        ? computePercentile(beatStrengths, cfg.strengthPercentile)
        : 0;

    const candidates: number[] = [];

    for (let i = 0; i < beats.length; i++) {
        const beatTime = beats[i];
        const beatInBar = i % 4;
        const barIndex = Math.floor(i / 4);

        // When strength data is available use it exclusively; stride is a fallback for grid-based beats only.
        const isStrongBeat = hasStrengths && beatStrengths![i] >= strengthThreshold;
        const isStridePosition = i % cfg.baseStride === 0;
        if (hasStrengths ? !isStrongBeat : !isStridePosition) continue;

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
    const noteTimes = generateNoteTimes(analysis.beats, difficulty, analysis.beatStrengths);
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

    let finalNotes = notes;
    if (difficulty !== 'easy' && mode !== 'trackpad') {
        finalNotes = [];
        const laneLastNote: Partial<Record<Lane, Note>> = {};

        for (const note of notes) {
            const last = laneLastNote[note.lane];
            if (last) {
                const interval = note.time - last.time;
                // Merge if interval is good for a hold (0.2s to 0.8s) with a 40% chance
                if (interval > 0.2 && interval <= 0.8 && seededValue(note.lane, note.time) < 0.4) {
                    last.type = 'hold';
                    last.duration = interval - 0.1; // Release slightly before next beat
                    laneLastNote[note.lane] = undefined; // Prevent merging 3 notes
                    continue;
                }
            }
            laneLastNote[note.lane] = note;
            finalNotes.push(note);
        }
    }

    return {
        songId,
        bpm: analysis.bpm,
        notes: finalNotes,
    };
}
