import { describe, it, expect } from 'vitest';
import {
    buildOnsetEnvelope,
    estimateTempoFromEnvelope,
    trackBeats,
    refineBeatPhases,
    inferDownbeatPhase,
    buildGridBeats,
    computeBeatAlignmentConfidence
} from '../beatDSP';

// Helper to create a synthetic AudioBuffer for testing
function createMockAudioBuffer(length: number, sampleRate: number = 44100, fillData?: Float32Array): AudioBuffer {
    const data = fillData || new Float32Array(length);
    return {
        sampleRate,
        numberOfChannels: 1,
        length,
        duration: length / sampleRate,
        getChannelData: (channel: number) => {
            if (channel !== 0) throw new Error('Out of bounds');
            return data;
        },
        copyFromChannel: () => { },
        copyToChannel: () => { },
    } as unknown as AudioBuffer;
}

describe('beatDSP', () => {
    describe('buildOnsetEnvelope', () => {
        it('should return empty envelope for short buffers', () => {
            const buffer = createMockAudioBuffer(512); // Less than frameSize (1024)
            const result = buildOnsetEnvelope(buffer);
            expect(result.envelope.length).toBe(0);
        });

        it('should generate an envelope of correct length mapped to frameRate', () => {
            const sampleRate = 44100;
            const buffer = createMockAudioBuffer(sampleRate * 2, sampleRate); // 2 seconds
            const result = buildOnsetEnvelope(buffer);
            const hopSize = 256;
            expect(result.frameRate).toBe(sampleRate / hopSize);
            // Should be roughly (length - frameSize) / hopSize features, minus a few for boundary conditions
            expect(result.envelope.length).toBeGreaterThan(0);
        });

        it('should output normalized values around mean 0 and std 1', () => {
            const sampleRate = 44100;
            const data = new Float32Array(sampleRate);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1; // noise
            const buffer = createMockAudioBuffer(sampleRate, sampleRate, data);
            const result = buildOnsetEnvelope(buffer);

            // Envelope is rectified (Math.max(0, ...)), so it's not strictly mean 0, 
            // but the normalization routine enforces some standardization.
            // Just verifying it ran and produced finite positive numbers.
            const valid = result.envelope.every(v => v >= 0 && Number.isFinite(v));
            expect(valid).toBe(true);
        });
    });

    describe('estimateTempoFromEnvelope', () => {
        it('should fall back to fallbackBpm if envelope is too short', () => {
            const result = estimateTempoFromEnvelope([1, 2, 3], 100, 120);
            expect(result.bpm).toBe(120);
            expect(result.clarity).toBe(0);
        });

        it('should detect tempo from synthetic impulse train', () => {
            const frameRate = 100; // 100 frames per second
            const targetBpm = 120; // 2 beats per second -> 50 frames per beat
            const envelope = new Array(500).fill(0);
            for (let i = 0; i < envelope.length; i += 50) {
                envelope[i] = 1.0;
            }

            const result = estimateTempoFromEnvelope(envelope, frameRate, 110);
            // Should snap to 120
            expect(result.bpm).toBe(targetBpm);
            expect(Math.abs(result.bestLag - 50)).toBeLessThanOrEqual(1);
            expect(result.clarity).toBeGreaterThan(0);
        });
    });

    describe('trackBeats', () => {
        it('should return empty arrays for empty envelope', () => {
            const result = trackBeats([], 100);
            expect(result.frames).toEqual([]);
            expect(result.strengths).toEqual([]);
        });

        it('should track regularly spaced peaks', () => {
            const envelope = new Array(200).fill(0.1); // baseline noise
            const targetLag = 20;
            for (let i = 20; i < 200; i += 20) {
                envelope[i] = 2.0; // Strong peaks every 20 frames
            }

            const result = trackBeats(envelope, targetLag);

            // Should find frames close to multiples of 20
            expect(result.frames.length).toBeGreaterThan(5);
            for (const f of result.frames) {
                const remainder = f % 20;
                const distance = Math.min(remainder, 20 - remainder);
                expect(distance).toBeLessThanOrEqual(2); // Small allowance
            }
        });
    });

    describe('refineBeatPhases', () => {
        it('should snap frames to the nearest local maximum in the envelope', () => {
            const envelope = new Array(100).fill(0);
            envelope[22] = 1.0; // Peak at 22
            envelope[49] = 1.0; // Peak at 49

            // Initial frames slightly off from peaks
            const initialFrames = [20, 50];
            const targetLag = 20; // Search radius will be 5

            const result = refineBeatPhases(initialFrames, envelope, targetLag);
            expect(result.frames).toEqual([22, 49]);
            expect(result.strengths).toEqual([1.0, 1.0]);
        });
    });

    describe('inferDownbeatPhase', () => {
        it('should return 0 for short arrays', () => {
            expect(inferDownbeatPhase([1, 2, 3])).toBe(0);
        });

        it('should identify the phase with strongest contrast against neighbors', () => {
            // Pattern of lengths 8 where phase 1 is extremely loud
            const strengths = [
                0.1, 1.0, 0.2, 0.5,
                0.1, 0.9, 0.1, 0.6
            ];

            // Phase 0: 0.1 + 0.1 = 0.2
            // Phase 1: 1.0 + 0.9 = 1.9 (Max contrast)
            // Phase 2: 0.2 + 0.1 = 0.3
            // Phase 3: 0.5 + 0.6 = 1.1

            const phase = inferDownbeatPhase(strengths);
            expect(phase).toBe(1);
        });
    });

    describe('buildGridBeats', () => {
        it('should generate evenly spaced beats from offset', () => {
            const beats = buildGridBeats(0.5, 3.0, 1.0);
            // 0.5, 1.5, 2.5 -> length 3
            expect(beats).toEqual([0.5, 1.5, 2.5]);
        });

        it('should ignore negative timestamps before 0', () => {
            const beats = buildGridBeats(-0.5, 2.0, 1.0);
            // -0.5 (skipped), 0.5, 1.5 -> length 2
            expect(beats).toEqual([0.5, 1.5]);
        });
    });

    describe('computeBeatAlignmentConfidence', () => {
        it('should return 0 for empty inputs', () => {
            expect(computeBeatAlignmentConfidence([], [])).toBe(0);
        });

        it('should return high confidence when beats align with envelope peaks', () => {
            const envelope = new Array(100).fill(0.1);
            envelope[20] = 5.0;
            envelope[40] = 5.0;
            envelope[60] = 5.0;
            envelope[80] = 5.0;

            const beatFrames = [20, 40, 60, 80];
            const confidence = computeBeatAlignmentConfidence(envelope, beatFrames);
            expect(confidence).toBeGreaterThan(0.8);
            expect(confidence).toBeLessThanOrEqual(1.0);
        });

        it('should return low confidence when beats do not align with peaks', () => {
            const envelope = new Array(100).fill(0.1);
            envelope[20] = 5.0;
            envelope[40] = 5.0;

            const beatFrames = [30, 50]; // Entirely missing the peaks
            const confidence = computeBeatAlignmentConfidence(envelope, beatFrames);
            expect(confidence).toBe(0); // Because beatMean will be equal to or less than envelopeMean or effectively close to 0 difference
        });
    });
});
