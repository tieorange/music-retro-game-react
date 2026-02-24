export class ConfidenceCalculator {
    public calculate(hasEnoughOnsets: boolean, tempoClarity: number, alignmentConfidence: number): number {
        if (!hasEnoughOnsets) {
            return 0.35;
        }
        return Math.min(1, tempoClarity * 0.7 + alignmentConfidence * 0.3);
    }
}
