import { HitJudgment } from '@/domain/types';
import { COMBO_THRESHOLDS } from '@/domain/constants';

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

    public hit(judgment: HitJudgment): void {
        if (judgment === 'miss') {
            this._combo = 0;
            this.updateMultiplier();
            return;
        }

        this._combo++;
        if (this._combo > this._maxCombo) {
            this._maxCombo = this._combo;
        }

        this.updateMultiplier();
    }

    private updateMultiplier(): void {
        let newMul = 1;
        for (const t of COMBO_THRESHOLDS) {
            if (this._combo >= t.combo) {
                newMul = t.multiplier;
            }
        }
        this._multiplier = newMul;
    }
}
