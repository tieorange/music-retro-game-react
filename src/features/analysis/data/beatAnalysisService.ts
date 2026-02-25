import { BeatAnalysis } from '@/features/analysis/domain/types';
import { OnsetAnalysisStrategy } from '@/features/analysis/domain/OnsetAnalysisStrategy';
import { ConfidenceCalculator } from '@/features/analysis/domain/ConfidenceCalculator';
import { logInfo, logError } from '@/core/logging';
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

        const t0 = performance.now();

        try {
            onProgress('Extracting rhythm (Essentia DSP Worker)...', 20);
            logInfo('analysis.worker.started', {
                numberOfChannels: audioBuffer.numberOfChannels,
                sampleRate: audioBuffer.sampleRate,
                duration: audioBuffer.duration,
            });

            // Transfer to worker
            const worker = new Worker(new URL('./beatAnalysis.worker.ts', import.meta.url), { type: 'module' });

            const channels: Float32Array[] = [];
            const transferables: ArrayBuffer[] = [];
            for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
                const data = audioBuffer.getChannelData(ch).slice(); // Copy to avoid detaching source buffer
                channels.push(data);
                transferables.push(data.buffer);
            }

            const workerPromise = new Promise<any>((resolve, reject) => {
                worker.onmessage = (e) => resolve(e.data);
                worker.onerror = (e) => reject(e);
                worker.postMessage({
                    channelData: channels,
                    sampleRate: audioBuffer.sampleRate,
                    length: audioBuffer.length
                }, transferables);
            });

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Beat analysis timed out after 30s')), 30_000)
            );

            const { beatTimes, bpm, success, error } = await Promise.race([workerPromise, timeoutPromise]);

            worker.terminate();
            logInfo('resource.worker.terminated', { workerName: 'beatAnalysis' });

            if (!success) {
                logError('analysis.worker.failed', { reason: error });
                throw new Error("Essentia worker failed: " + error);
            }
            if (!bpm || bpm <= 0) {
                logError('analysis.worker.failed', { reason: `Invalid BPM: ${bpm}` });
                throw new Error(`Invalid BPM from analysis: ${bpm}. Cannot generate beat map.`);
            }

            const durationMs = Math.round(performance.now() - t0);
            logInfo('analysis.worker.succeeded', { bpm, beatCount: beatTimes.length, durationMs });
            logInfo('perf.analysis.duration', { ms: durationMs });

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

                // Ensure strengths array matches onsetBeats length exactly
                if (onsetBeats.length > 0) {
                    if (alignedStrengths.length > onsetBeats.length) {
                        alignedStrengths = alignedStrengths.slice(0, onsetBeats.length);
                    } else if (alignedStrengths.length < onsetBeats.length) {
                        const padding: number[] = new Array(onsetBeats.length - alignedStrengths.length).fill(0);
                        alignedStrengths = alignedStrengths.concat(padding);
                    }
                }
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
            logError('analysis.failed', { message: error.message }, error);
            throw new Error('Analysis failed: ' + error.message);
        }
    }
}
