import { BeatAnalysis } from '@/features/analysis/domain/types';
import { OnsetAnalysisStrategy } from '@/features/analysis/domain/OnsetAnalysisStrategy';
import { ConfidenceCalculator } from '@/features/analysis/domain/ConfidenceCalculator';
import {
    buildOnsetEnvelope,
    trackBeats,
    inferDownbeatPhase,
    buildGridBeats,
    computeBeatAlignmentConfidence
} from './beatDSP';

export class BeatAnalysisService {
    public async analyze(audioBuffer: AudioBuffer, onProgress: (stage: string, percent: number) => void): Promise<BeatAnalysis> {
        onProgress('Initializing analysis...', 10);

        try {
            onProgress('Extracting rhythm (Essentia DSP Worker)...', 20);

            // Transfer to worker
            const worker = new Worker(new URL('./beatAnalysis.worker.ts', import.meta.url), { type: 'module' });

            const channels: Float32Array[] = [];
            const transferables: ArrayBuffer[] = [];
            for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
                const data = audioBuffer.getChannelData(ch).slice(); // Copy to avoid detaching source buffer
                channels.push(data);
                transferables.push(data.buffer);
            }

            const { beatTimes, bpm, success, error } = await new Promise<any>((resolve, reject) => {
                worker.onmessage = (e) => resolve(e.data);
                worker.onerror = (e) => reject(e);
                worker.postMessage({
                    channelData: channels,
                    sampleRate: audioBuffer.sampleRate,
                    length: audioBuffer.length
                }, transferables);
            });

            worker.terminate();

            if (!success) {
                throw new Error("Essentia worker failed: " + error);
            }

            onProgress('Generating beat map...', 60);

            const offset = beatTimes.length > 0 ? beatTimes[0] : 0;
            const duration = audioBuffer.duration;
            const beatInterval = 60 / bpm;

            onProgress('Aligning downbeats...', 80);
            const envelopeData = buildOnsetEnvelope(audioBuffer);

            let alignedStrengths: number[] = [];
            let onsetBeats: number[] = beatTimes;
            let alignmentConfidence = 0;

            if (envelopeData.envelope.length > 0) {
                // Ensure essentia tracked beats line up with our basic envelope for confidence scoring
                const tracked = trackBeats(envelopeData.envelope, Math.round(60 / bpm * envelopeData.frameRate));
                const downbeatPhase = inferDownbeatPhase(tracked.strengths);

                alignedStrengths = tracked.strengths.slice(downbeatPhase);
                alignmentConfidence = computeBeatAlignmentConfidence(envelopeData.envelope, tracked.frames);
            }

            const gridBeats = buildGridBeats(offset, duration, beatInterval);

            const strategy = new OnsetAnalysisStrategy();
            // We pass essentia's beats in as the primary.
            const strategyResult = strategy.determineBeats(
                onsetBeats,
                alignedStrengths,
                gridBeats,
                bpm,
                bpm
            );

            const calculator = new ConfidenceCalculator();
            const confidence = calculator.calculate(
                strategyResult.hasEnoughOnsets,
                1.0, // essentia clarity is assumed high
                Math.max(0.5, alignmentConfidence)
            );

            onProgress('Finalizing...', 100);

            return {
                bpm: strategyResult.bpm,
                beats: strategyResult.beats,
                confidence,
                beatStrengths: strategyResult.beatStrengths
            };
        } catch (error: any) {
            throw new Error('Analysis failed: ' + error.message);
        }
    }
}
