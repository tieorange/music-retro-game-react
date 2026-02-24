import { HitJudgment } from '@/features/gameplay/domain/types';
import { COMBO_THRESHOLDS } from '@/features/gameplay/domain/constants';

export interface ComboResult {
    combo: number;
    multiplier: number;
    isMilestone: boolean;
    isBreak: boolean;
}


export class ComboTracker {
    private _combo: number = 0;
    private _maxCombo: number = 0;
    private _multiplier: number = 1;

    public get combo(): number {
        return this._combo;
    }

    public get maxCombo(): number {
        return this._maxCombo;
    }

    public get multiplier(): number {
        return this._multiplier;
    }

    public hit(judgment: HitJudgment): ComboResult {
        let isBreak = false;
        let isMilestone = false;

        if (judgment === 'miss') {
            isBreak = this._combo > 0;
            this._combo = 0;
            this.updateMultiplier();
            return { combo: this._combo, multiplier: this._multiplier, isMilestone, isBreak };
        }

        this._combo++;
        if (this._combo > this._maxCombo) {
            this._maxCombo = this._combo;
        }

        this.updateMultiplier();

        const isThreshold = COMBO_THRESHOLDS.some(t => t.combo === this._combo) || (this._combo >= 50 && this._combo % 50 === 0);
        if (isThreshold && this._combo >= 10) {
            isMilestone = true;
        }

        return { combo: this._combo, multiplier: this._multiplier, isMilestone, isBreak };
    }

    private updateMultiplier(): void {
        let newMul = 1;
        const sortedThresholds = [...COMBO_THRESHOLDS].sort((a, b) => a.combo - b.combo);
        for (const t of sortedThresholds) {
            if (this._combo >= t.combo) {
                newMul = t.multiplier;
            }
        }
        this._multiplier = newMul;
    }
}
