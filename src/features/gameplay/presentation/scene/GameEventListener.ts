import { GameEventBus } from '@/features/gameplay/domain/GameEventBus';
import { IHitSoundPort } from '@/features/gameplay/application/ports/IHitSoundPort';
import { LaneRenderer } from './LaneRenderer';
import { HitZoneRenderer } from './HitZoneRenderer';
import { EffectsController } from './EffectsController';
import { HitEvent, MissEvent, ComboMilestoneEvent } from '@/features/gameplay/domain/types';

export class GameEventListener {
    private events: GameEventBus;
    private hitSounds: IHitSoundPort;
    private lanes: LaneRenderer;
    private hitZone: HitZoneRenderer;
    private effects: EffectsController;

    constructor(
        events: GameEventBus,
        hitSounds: IHitSoundPort,
        lanes: LaneRenderer,
        hitZone: HitZoneRenderer,
        effects: EffectsController
    ) {
        this.events = events;
        this.hitSounds = hitSounds;
        this.lanes = lanes;
        this.hitZone = hitZone;
        this.effects = effects;

        this.events.on('hit', this.onHit);
        this.events.on('miss', this.onMiss);
        this.events.on('combo-break', this.onComboBreak);
        this.events.on('combo-milestone', this.onComboMilestone);
    }

    private onHit = (e: HitEvent) => {
        this.hitSounds.playHit(e.judgment);
        this.lanes.flashLane(e.lane);
        this.hitZone.flashPad(e.lane, e.judgment);
        this.effects.triggerHit(e.judgment);
    };

    private onMiss = (e: MissEvent) => {
        this.hitSounds.playHit('miss');
        this.hitZone.flashPad(e.lane, 'miss');
        this.effects.triggerMiss();
    };

    private onComboMilestone = (e: ComboMilestoneEvent) => {
        this.hitSounds.playMilestone(e.combo);
    };

    private onComboBreak = () => {
        this.hitSounds.playComboBreak();
    };

    public destroy() {
        this.events.off('hit', this.onHit);
        this.events.off('miss', this.onMiss);
        this.events.off('combo-break', this.onComboBreak);
        this.events.off('combo-milestone', this.onComboMilestone);
        // We do not destroy hitSounds here since it was injected
    }
}
