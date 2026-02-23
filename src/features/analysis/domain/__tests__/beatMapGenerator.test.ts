import { describe, it, expect } from 'vitest';
import { generateBeatMap } from '../beatMapGenerator';
import { BeatAnalysis } from '@/features/analysis/domain/types';;

describe('beatMapGenerator', () => {
    it('should scale note density appropriately across difficulty levels', () => {
        const mockBeats = Array.from({ length: 100 }, (_, i) => i * 0.3); // 0.3s intervals
        const mockStrengths = Array.from({ length: 100 }, (_, _i) => Math.random());
        const mockAnalysis: BeatAnalysis = {
            bpm: 200, // Matching 0.3s
            beats: mockBeats,
            confidence: 0.9,
            beatStrengths: mockStrengths
        };

        const easyMap = generateBeatMap('test', mockAnalysis, 'classic', 'easy');
        const normalMap = generateBeatMap('test', mockAnalysis, 'classic', 'normal');
        const hardMap = generateBeatMap('test', mockAnalysis, 'classic', 'hard');
        const expertMap = generateBeatMap('test', mockAnalysis, 'classic', 'expert');

        // Easy map should have fewer notes than expert
        expect(easyMap.notes.length).toBeLessThan(normalMap.notes.length);
        expect(normalMap.notes.length).toBeLessThanOrEqual(hardMap.notes.length);
        expect(hardMap.notes.length).toBeLessThanOrEqual(expertMap.notes.length);

        // Expert should use a good portion of the beat timestamps
        expect(expertMap.notes.length).toBeGreaterThan(80);
    });

    it('should lock notes to lane 1 in trackpad mode regardless of difficulty', () => {
        const mockBeats = [0, 0.5, 1.0, 1.5];
        const mockAnalysis: BeatAnalysis = {
            bpm: 120,
            beats: mockBeats,
            confidence: 0.9
        };

        const expertTrackpadMap = generateBeatMap('test', mockAnalysis, 'trackpad', 'expert');

        expect(expertTrackpadMap.notes.length).toBeGreaterThan(0);
        for (const note of expertTrackpadMap.notes) {
            expect(note.lane).toBe(0); // Trackpad mode forces lane 0
        }
    });

    it('should return empty notes when given empty beats array', () => {
        const map = generateBeatMap('test', { bpm: 120, beats: [], confidence: 1 }, 'classic', 'normal');
        expect(map.notes).toEqual([]);
    });

    it('should produce exactly one note for a single beat input', () => {
        const map = generateBeatMap('test', { bpm: 120, beats: [1.0], confidence: 1 }, 'classic', 'normal');
        expect(map.notes.length).toBe(1);
        expect(map.notes[0].time).toBe(1.0);
    });

    it('should enforce minGap between consecutive notes', () => {
        // Provide beats that are extremely close together (0.05s)
        const mockBeats = Array.from({ length: 20 }, (_, i) => i * 0.05);
        const map = generateBeatMap('test', { bpm: 120, beats: mockBeats, confidence: 1 }, 'classic', 'expert');

        // Configuration for expert has minGap of 0.1
        for (let i = 1; i < map.notes.length; i++) {
            const gap = map.notes[i].time - map.notes[i - 1].time;
            // Allow minor floating point inaccuracies
            expect(gap).toBeGreaterThanOrEqual(0.099);
        }
    });

    it('should produce notes on offbeats for hard/expert difficulties', () => {
        // Wide intervals (0.5s = 120bpm) should trigger offbeat generation for higher difficulties
        const mockBeats = Array.from({ length: 16 }, (_, i) => i * 0.5);

        const easyMap = generateBeatMap('test', { bpm: 120, beats: mockBeats, confidence: 1 }, 'classic', 'easy');
        const expertMap = generateBeatMap('test', { bpm: 120, beats: mockBeats, confidence: 1 }, 'classic', 'expert');

        // Expert should generate offbeats (notes between the core beats)
        expect(expertMap.notes.length).toBeGreaterThan(easyMap.notes.length);

        // Find at least one note that is NOT on the core beat grid
        const hasOffbeat = expertMap.notes.some(note => !mockBeats.includes(note.time));
        expect(hasOffbeat).toBe(true);
    });

    it('should use all 4 lanes in classic mode for longer sequences', () => {
        const mockBeats = Array.from({ length: 100 }, (_, i) => i * 0.5);
        const map = generateBeatMap('test', { bpm: 120, beats: mockBeats, confidence: 1 }, 'classic', 'normal');

        const usedLanes = new Set(map.notes.map(n => n.lane));
        expect(usedLanes.size).toBe(4);
        expect(usedLanes.has(0)).toBe(true);
        expect(usedLanes.has(1)).toBe(true);
        expect(usedLanes.has(2)).toBe(true);
        expect(usedLanes.has(3)).toBe(true);
    });

    it('should not place notes in the same lane more than 3 times consecutively (anti-stuck)', () => {
        // High chance of same lane if laneJumpChance was low, but logic caps it at 3
        const mockBeats = Array.from({ length: 150 }, (_, i) => i * 0.5);
        const map = generateBeatMap('test', { bpm: 120, beats: mockBeats, confidence: 1 }, 'classic', 'easy');

        let consecutiveLane = map.notes[0].lane;
        let count = 1;

        for (let i = 1; i < map.notes.length; i++) {
            if (map.notes[i].lane === consecutiveLane) {
                count++;
                expect(count).toBeLessThanOrEqual(3);
            } else {
                consecutiveLane = map.notes[i].lane;
                count = 1;
            }
        }
    });

    it('should be deterministic (producing same arrays for identical inputs)', () => {
        const mockBeats = Array.from({ length: 50 }, (_, i) => i * 0.4);
        const analysis: BeatAnalysis = { bpm: 150, beats: mockBeats, confidence: 0.8 };

        const map1 = generateBeatMap('test', analysis, 'classic', 'hard');
        const map2 = generateBeatMap('test', analysis, 'classic', 'hard');

        // Map 1 and 2 shouldn't just be similar, they should have identical lane assignments
        // (ID will be different because of nanoid, but time and lane should match)
        expect(map1.notes.length).toBe(map2.notes.length);
        for (let i = 0; i < map1.notes.length; i++) {
            expect(map1.notes[i].time).toBe(map2.notes[i].time);
            expect(map1.notes[i].lane).toBe(map2.notes[i].lane);
        }
    });

    it('should filter out weak beats in easier difficulties if strengths are provided', () => {
        const mockBeats = [1, 2, 3, 4, 5, 6, 7, 8];
        // Only beats 1 and 5 are strong
        const beatStrengths = [1.0, 0.1, 0.1, 0.1, 1.0, 0.1, 0.1, 0.1];

        const map = generateBeatMap('test', { bpm: 60, beats: mockBeats, confidence: 1, beatStrengths }, 'classic', 'easy');

        // Easy mode filters by 75th percentile strength, so mostly only the 1.0s should survive
        expect(map.notes.some(n => n.time === 1)).toBe(true);
        expect(map.notes.some(n => n.time === 5)).toBe(true);
        // It shouldn't include many notes (probably just those 2 strong ones, maybe a few weak ones due to minGap constraints logic bypass)
        // Wait, easy mode strength percentile is 75%, so it includes top 25% of beats. 
        // 2/8 is exactly 25%, so exactly 2 notes should be generated.
        expect(map.notes.length).toBe(2);
    });
});
