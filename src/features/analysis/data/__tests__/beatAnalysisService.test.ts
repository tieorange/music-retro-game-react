import { describe, it, expect, beforeAll } from 'vitest';
import { BeatAnalysisService } from '../beatAnalysisService';
import { BeatAnalysis } from '@/features/analysis/domain/types';

// @ts-ignore
import queenMp3Url from '../../../../../Queen - We Will Rock You.mp3?url';

describe('BeatAnalysisService - Integration', () => {
    let analysis: BeatAnalysis;
    let duration: number;

    beforeAll(async () => {
        // Fetch the audio file from the test server
        const response = await fetch(queenMp3Url);
        const arrayBuffer = await response.arrayBuffer();

        // Decode the audio in the browser environment
        // The standard AudioContext is available in vitest browser mode via Playwright
        const audioCtx = new window.AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        duration = audioBuffer.duration;

        // Run the analysis
        const service = new BeatAnalysisService();

        let lastProgress = 0;
        analysis = await service.analyze(audioBuffer, (_stage, percent) => {
            lastProgress = percent;
        });

        // Verify the progress reached 100%
        expect(lastProgress).toBe(100);
    }, 30000); // 30 second timeout as fetch & analysis takes some time

    it('should extract correct BPM for "We Will Rock You"', () => {
        // ~81 BPM or double time ~162
        const isValidBpm = (analysis.bpm >= 79 && analysis.bpm <= 83) ||
            (analysis.bpm >= 158 && analysis.bpm <= 166);
        expect(isValidBpm).toBe(true);
    });

    it('should have high confidence > 0.2', () => {
        expect(analysis.confidence).toBeGreaterThan(0.2);
    });

    it('should extract a reasonable number of sequential beats within duration bounds', () => {
        expect(analysis.beats.length).toBeGreaterThan(50);

        for (let i = 0; i < analysis.beats.length; i++) {
            expect(analysis.beats[i]).toBeGreaterThanOrEqual(0);
            expect(analysis.beats[i]).toBeLessThanOrEqual(duration);
            if (i > 0) {
                expect(analysis.beats[i]).toBeGreaterThan(analysis.beats[i - 1]);
            }
        }
    });

    it('should produce consistent beat intervals matching the BPM', () => {
        const expectedInterval = 60 / analysis.bpm;
        let validIntervals = 0;

        for (let i = 1; i < analysis.beats.length; i++) {
            const interval = analysis.beats[i] - analysis.beats[i - 1];
            // Allow ±20% tolerance for human performance micro-timing
            if (interval > expectedInterval * 0.8 && interval < expectedInterval * 1.2) {
                validIntervals++;
            }
        }

        // Most intervals should be clustered near the tempo
        expect(validIntervals / analysis.beats.length).toBeGreaterThan(0.7);
    });

    it('should include beat strengths parallel array', () => {
        expect(analysis.beatStrengths).toBeDefined();
        expect(analysis.beatStrengths?.length).toBe(analysis.beats.length);
    });

    it('should detect dynamic range variance (stomp/clap differences)', () => {
        const strengths = analysis.beatStrengths!;
        const maxStrength = Math.max(...strengths);
        const minStrength = Math.min(...strengths);

        expect(maxStrength).toBeGreaterThan(0);
        expect(minStrength).toBeLessThan(maxStrength);

        let strongClaps = 0;
        for (const s of strengths) {
            if (s > maxStrength * 0.7) {
                strongClaps++;
            }
        }

        // There should be frequent strong peaks throughout the song
        expect(strongClaps).toBeGreaterThan(20);
    });
});

