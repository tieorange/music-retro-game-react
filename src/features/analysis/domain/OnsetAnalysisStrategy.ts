export interface AnalysisStrategyResult {
    beats: number[];
    bpm: number;
    beatStrengths?: number[];
    hasEnoughOnsets: boolean;
}

export class OnsetAnalysisStrategy {
    private readonly MIN_ONSETS = 16;

    public determineBeats(
        onsetBeats: number[],
        onsetStrengths: number[],
        gridBeats: number[],
        onsetBpm: number,
        guessBpm: number
    ): AnalysisStrategyResult {
        const hasEnoughOnsets = onsetBeats.length >= this.MIN_ONSETS;

        return {
            beats: hasEnoughOnsets ? onsetBeats : gridBeats,
            bpm: hasEnoughOnsets ? onsetBpm : guessBpm,
            beatStrengths: hasEnoughOnsets ? onsetStrengths : undefined,
            hasEnoughOnsets
        };
    }
}
