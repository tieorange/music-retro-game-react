import { HitJudgment } from '@/features/gameplay/domain/types';

export interface IHitSoundPort {
    init?(): Promise<void> | void;
    playHit(judgment: HitJudgment): void;
    playMilestone(combo: number): void;
    playComboBreak(): void;
    destroy(): void;
}
