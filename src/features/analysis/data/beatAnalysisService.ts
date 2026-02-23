import { guess } from 'web-audio-beat-detector';
import { BeatAnalysis } from '@/features/analysis/domain/types';;
import {
    buildOnsetEnvelope,
    estimateTempoFromEnvelope,
    trackBeats,
    refineBeatPhases,
    inferDownbeatPhase,
    buildGridBeats,
    computeBeatAlignmentConfidence
} from './beatDSP';

export class BeatAnalysisService {
    public async analyze(audioBuffer: AudioBuffer, onProgress: (stage: string, percent: number) => void): Promise<BeatAnalysis> {
        onProgress('Initializing analysis...', 10);

        try {
            onProgress('Extracting rhythm...', 40);

            // web-audio-beat-detector uses Web Workers internally to avoid blocking the UI
            const result = await guess(audioBuffer);

            onProgress('Generating beat map...', 80);

            const bpm = result.bpm;
            const offset = result.offset;
            const duration = audioBuffer.duration;
            const beatInterval = 60 / bpm;

            onProgress('Refining beat timings...', 90);

            const envelopeData = buildOnsetEnvelope(audioBuffer);
            const tempoEstimate = estimateTempoFromEnvelope(envelopeData.envelope, envelopeData.frameRate, bpm);
            const tracked = trackBeats(envelopeData.envelope, tempoEstimate.bestLag);
            const refined = refineBeatPhases(tracked.frames, envelopeData.envelope, tempoEstimate.bestLag);
            const downbeatPhase = inferDownbeatPhase(refined.strengths);

            // Align beat index 0 to inferred downbeat for stronger 4/4 feel.
            const alignedFrames = refined.frames.slice(downbeatPhase);
            const alignedStrengths = refined.strengths.slice(downbeatPhase);
            const onsetBeats = alignedFrames.map((frame) => frame / envelopeData.frameRate);

            // Fallback to tempo grid only if onset extraction is too weak.
            const beats = onsetBeats.length >= 16
                ? onsetBeats
                : buildGridBeats(offset, duration, beatInterval);

            const estimatedBpm = onsetBeats.length >= 16
                ? tempoEstimate.bpm
                : bpm;

            const confidence = onsetBeats.length >= 16
                ? Math.min(1, tempoEstimate.clarity * 0.7 + computeBeatAlignmentConfidence(envelopeData.envelope, tracked.frames) * 0.3)
                : 0.35;

            onProgress('Finalizing...', 100);

            return {
                bpm: estimatedBpm,
                beats,
                confidence,
                beatStrengths: onsetBeats.length >= 16 ? alignedStrengths : undefined
            };
        } catch (error: any) {
            throw new Error('Analysis failed: ' + error.message);
        }
    }
}
