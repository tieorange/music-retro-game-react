import { guess } from 'web-audio-beat-detector';
import { BeatAnalysis } from '../../domain/types';

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

            const envelopeData = this.buildOnsetEnvelope(audioBuffer);
            const tempoEstimate = this.estimateTempoFromEnvelope(envelopeData.envelope, envelopeData.frameRate, bpm);
            const tracked = this.trackBeats(envelopeData.envelope, tempoEstimate.bestLag);
            const downbeatPhase = this.inferDownbeatPhase(tracked.strengths);

            // Align beat index 0 to inferred downbeat for stronger 4/4 feel.
            const alignedFrames = tracked.frames.slice(downbeatPhase);
            const onsetBeats = alignedFrames.map((frame) => frame / envelopeData.frameRate);

            // Fallback to tempo grid only if onset extraction is too weak.
            const beats = onsetBeats.length >= 16
                ? onsetBeats
                : this.buildGridBeats(offset, duration, beatInterval);

            const estimatedBpm = onsetBeats.length >= 16
                ? tempoEstimate.bpm
                : bpm;

            const confidence = onsetBeats.length >= 16
                ? Math.min(1, tempoEstimate.clarity * 0.7 + this.computeBeatAlignmentConfidence(envelopeData.envelope, tracked.frames) * 0.3)
                : 0.35;

            onProgress('Finalizing...', 100);

            return {
                bpm: estimatedBpm,
                beats,
                confidence
            };
        } catch (error: any) {
            throw new Error('Analysis failed: ' + error.message);
        }
    }

    private buildOnsetEnvelope(audioBuffer: AudioBuffer): { envelope: number[]; frameRate: number } {
        const sampleRate = audioBuffer.sampleRate;
        const frameSize = 1024;
        const hopSize = 256;
        const channelCount = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;

        const channelData: Float32Array[] = [];
        for (let ch = 0; ch < channelCount; ch++) {
            channelData.push(audioBuffer.getChannelData(ch));
        }

        if (length < frameSize || channelCount === 0) {
            return { envelope: [], frameRate: sampleRate / hopSize };
        }

        const feature: number[] = [];

        for (let start = 0; start + frameSize <= length; start += hopSize) {
            let energy = 0;
            let highFreqEnergy = 0;
            let previousSample = 0;

            for (let i = 0; i < frameSize; i++) {
                let mixed = 0;
                for (let ch = 0; ch < channelCount; ch++) {
                    mixed += channelData[ch][start + i];
                }
                mixed /= channelCount;
                energy += Math.abs(mixed);
                highFreqEnergy += Math.abs(mixed - previousSample);
                previousSample = mixed;
            }

            feature.push((energy * 0.35 + highFreqEnergy * 0.65) / frameSize);
        }

        if (feature.length < 3) {
            return { envelope: [], frameRate: sampleRate / hopSize };
        }

        // First-order difference highlights transients.
        const onsetStrength: number[] = [0];
        for (let i = 1; i < feature.length; i++) {
            onsetStrength.push(Math.max(0, feature[i] - feature[i - 1]));
        }

        // Remove slow trend via local mean subtraction.
        const window = 16;
        const envelope = onsetStrength.map((value, index) => {
            const from = Math.max(0, index - window);
            const to = Math.min(onsetStrength.length - 1, index + window);
            let sum = 0;
            for (let i = from; i <= to; i++) sum += onsetStrength[i];
            const localMean = sum / (to - from + 1);
            return Math.max(0, value - localMean * 0.9);
        });

        // Normalize envelope.
        const mean = envelope.reduce((acc, v) => acc + v, 0) / envelope.length;
        const variance = envelope.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / envelope.length;
        const std = Math.sqrt(variance);
        const normalized = std > 1e-6
            ? envelope.map((v) => Math.max(0, (v - mean) / std))
            : envelope.map(() => 0);

        return {
            envelope: normalized,
            frameRate: sampleRate / hopSize,
        };
    }

    private estimateTempoFromEnvelope(
        envelope: number[],
        frameRate: number,
        fallbackBpm: number
    ): { bestLag: number; bpm: number; clarity: number } {
        if (envelope.length < 8) {
            const lag = Math.max(1, Math.round((60 / fallbackBpm) * frameRate));
            return { bestLag: lag, bpm: fallbackBpm, clarity: 0 };
        }

        const minBpm = 70;
        const maxBpm = 190;
        const minLag = Math.max(1, Math.floor((60 / maxBpm) * frameRate));
        const maxLag = Math.max(minLag + 1, Math.ceil((60 / minBpm) * frameRate));

        let bestLag = Math.max(1, Math.round((60 / fallbackBpm) * frameRate));
        let bestScore = -Infinity;
        let secondBest = -Infinity;

        for (let lag = minLag; lag <= maxLag; lag++) {
            let ac = 0;
            for (let i = lag; i < envelope.length; i++) {
                ac += envelope[i] * envelope[i - lag];
            }
            // Favor lags near fallback guess slightly, to reduce octave mistakes.
            const lagSeconds = lag / frameRate;
            const bpm = 60 / lagSeconds;
            const proximity = 1 - Math.min(1, Math.abs(bpm - fallbackBpm) / fallbackBpm);
            const score = ac * (0.9 + proximity * 0.1);

            if (score > bestScore) {
                secondBest = bestScore;
                bestScore = score;
                bestLag = lag;
            } else if (score > secondBest) {
                secondBest = score;
            }
        }

        const bpm = Math.round(60 / (bestLag / frameRate));
        const clarity = bestScore > 0 ? Math.max(0, Math.min(1, (bestScore - Math.max(0, secondBest)) / bestScore)) : 0;

        return {
            bestLag,
            bpm: Math.max(70, Math.min(190, bpm)),
            clarity,
        };
    }

    private trackBeats(envelope: number[], targetLag: number): { frames: number[]; strengths: number[] } {
        if (envelope.length === 0) return { frames: [], strengths: [] };

        const lagMin = Math.max(1, Math.floor(targetLag * 0.7));
        const lagMax = Math.max(lagMin + 1, Math.ceil(targetLag * 1.4));
        const tightness = 22;

        const score = new Array<number>(envelope.length).fill(0);
        const previous = new Array<number>(envelope.length).fill(-1);

        for (let i = 0; i < envelope.length; i++) {
            const local = envelope[i];
            let bestScore = local;
            let bestPrev = -1;

            for (let lag = lagMin; lag <= lagMax; lag++) {
                const prevIdx = i - lag;
                if (prevIdx < 0) continue;

                const intervalPenalty = -tightness * Math.pow(Math.log(lag / targetLag), 2);
                const candidate = score[prevIdx] + local + intervalPenalty;
                if (candidate > bestScore) {
                    bestScore = candidate;
                    bestPrev = prevIdx;
                }
            }

            score[i] = bestScore;
            previous[i] = bestPrev;
        }

        let cursor = 0;
        for (let i = 1; i < score.length; i++) {
            if (score[i] > score[cursor]) cursor = i;
        }

        const frames: number[] = [];
        while (cursor >= 0) {
            frames.push(cursor);
            cursor = previous[cursor];
        }
        frames.reverse();

        // Remove near-duplicates and very weak beats.
        const filteredFrames: number[] = [];
        const strengths: number[] = [];
        const minGap = Math.max(1, Math.floor(targetLag * 0.45));

        for (const frame of frames) {
            const strength = envelope[frame] ?? 0;
            const lastFrame = filteredFrames[filteredFrames.length - 1];
            if (lastFrame === undefined || frame - lastFrame >= minGap) {
                filteredFrames.push(frame);
                strengths.push(strength);
            } else if (strength > strengths[strengths.length - 1]) {
                filteredFrames[filteredFrames.length - 1] = frame;
                strengths[strengths.length - 1] = strength;
            }
        }

        return { frames: filteredFrames, strengths };
    }

    private inferDownbeatPhase(strengths: number[]): number {
        if (strengths.length < 8) return 0;

        const phaseScores = [0, 0, 0, 0];
        for (let i = 0; i < strengths.length; i++) {
            phaseScores[i % 4] += strengths[i];
        }

        let bestPhase = 0;
        for (let p = 1; p < 4; p++) {
            if (phaseScores[p] > phaseScores[bestPhase]) {
                bestPhase = p;
            }
        }

        return bestPhase;
    }

    private buildGridBeats(offset: number, duration: number, beatInterval: number): number[] {
        const beats: number[] = [];
        let currentBeatTime = offset;
        while (currentBeatTime < duration) {
            if (currentBeatTime >= 0) beats.push(currentBeatTime);
            currentBeatTime += beatInterval;
        }
        return beats;
    }

    private computeBeatAlignmentConfidence(envelope: number[], beatFrames: number[]): number {
        if (envelope.length === 0 || beatFrames.length === 0) return 0;

        const envelopeMean = envelope.reduce((acc, value) => acc + value, 0) / envelope.length;
        let beatMean = 0;
        let count = 0;

        for (const frame of beatFrames) {
            const value = envelope[frame];
            if (value !== undefined) {
                beatMean += value;
                count++;
            }
        }

        if (count === 0) return 0;
        beatMean /= count;

        if (beatMean <= 0) return 0;
        return Math.max(0, Math.min(1, (beatMean - envelopeMean) / Math.max(0.25, beatMean)));
    }
}
