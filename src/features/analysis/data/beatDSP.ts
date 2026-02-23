export function buildOnsetEnvelope(audioBuffer: AudioBuffer): { envelope: number[]; frameRate: number } {
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

    // Pre-compute bass band via first-order IIR lowpass (~200 Hz cutoff).
    const lpAlpha = 1 - Math.exp(-2 * Math.PI * 200 / sampleRate);
    const bassSignal = new Float32Array(length);
    {
        let lpState = 0;
        for (let n = 0; n < length; n++) {
            let mono = 0;
            for (let ch = 0; ch < channelCount; ch++) mono += channelData[ch][n];
            mono /= channelCount;
            lpState += lpAlpha * (mono - lpState);
            bassSignal[n] = lpState;
        }
    }

    const feature: number[] = [];
    let prevHighSample = 0;

    for (let start = 0; start + frameSize <= length; start += hopSize) {
        let bassEnergy = 0;
        let highFlux = 0;

        for (let i = 0; i < frameSize; i++) {
            const n = start + i;
            let mono = 0;
            for (let ch = 0; ch < channelCount; ch++) mono += channelData[ch][n];
            mono /= channelCount;

            const bass = bassSignal[n];
            const high = mono - bass;
            bassEnergy += Math.abs(bass);
            highFlux += Math.abs(high - prevHighSample);
            prevHighSample = high;
        }

        // Bass energy detects kick drum onsets; high-band flux detects hi-hat/snare attacks.
        feature.push((bassEnergy * 0.6 + highFlux * 0.4) / frameSize);
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

export function estimateTempoFromEnvelope(
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

export function trackBeats(envelope: number[], targetLag: number): { frames: number[]; strengths: number[] } {
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

export function refineBeatPhases(
    frames: number[],
    envelope: number[],
    targetLag: number
): { frames: number[]; strengths: number[] } {
    // Snap each DP-tracked beat to the nearest local onset peak within ±25% of the beat interval.
    const searchRadius = Math.round(targetLag * 0.25);
    const refined: number[] = [];
    const refinedStrengths: number[] = [];

    for (let i = 0; i < frames.length; i++) {
        const center = frames[i];
        const from = Math.max(0, center - searchRadius);
        const to = Math.min(envelope.length - 1, center + searchRadius);

        let bestFrame = center;
        let bestStrength = envelope[center] ?? 0;

        for (let f = from; f <= to; f++) {
            const s = envelope[f] ?? 0;
            if (s > bestStrength) {
                bestStrength = s;
                bestFrame = f;
            }
        }

        // Skip if two adjacent beats snapped to the same peak (would create duplicate).
        if (refined.length === 0 || bestFrame !== refined[refined.length - 1]) {
            refined.push(bestFrame);
            refinedStrengths.push(bestStrength);
        }
    }

    return { frames: refined, strengths: refinedStrengths };
}

export function inferDownbeatPhase(strengths: number[]): number {
    if (strengths.length < 8) return 0;

    const phaseScores = [0, 0, 0, 0];
    for (let i = 0; i < strengths.length; i++) {
        phaseScores[i % 4] += strengths[i];
    }

    // Pick the phase most elevated above its immediate neighbors rather than raw maximum.
    let bestPhase = 0;
    let bestContrast = -Infinity;
    for (let p = 0; p < 4; p++) {
        const neighborMean = (phaseScores[(p + 1) % 4] + phaseScores[(p + 3) % 4]) / 2;
        const contrast = phaseScores[p] - neighborMean;
        if (contrast > bestContrast) {
            bestContrast = contrast;
            bestPhase = p;
        }
    }

    return bestPhase;
}

export function buildGridBeats(offset: number, duration: number, beatInterval: number): number[] {
    const beats: number[] = [];
    let currentBeatTime = offset;
    while (currentBeatTime < duration) {
        if (currentBeatTime >= 0) beats.push(currentBeatTime);
        currentBeatTime += beatInterval;
    }
    return beats;
}

export function computeBeatAlignmentConfidence(envelope: number[], beatFrames: number[]): number {
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
