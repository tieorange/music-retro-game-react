import { Container, Application, Graphics } from 'pixi.js';
import { GameEngine } from '../engine/GameEngine';
import { LaneRenderer } from './LaneRenderer';
import { NoteRenderer } from './NoteRenderer';
import { HitZoneRenderer } from './HitZoneRenderer';
import { BackgroundRenderer } from './BackgroundRenderer';
import { HUDRenderer } from './HUDRenderer';
import { HitFeedbackRenderer } from './HitFeedbackRenderer';
import { LANE_COUNT } from '@/domain/constants';
import { applyGameEffects } from './effects';
import { AdvancedBloomFilter, CRTFilter, GlitchFilter } from 'pixi-filters';
import * as Tone from 'tone';
import { useGameStore } from '@/shared/stores/gameStore';
import { HitSoundService } from '@/infrastructure/audio/hitSounds';
import { HitEvent, MissEvent, ComboMilestoneEvent } from '@/domain/types';

export class GameScene extends Container {
    private app: Application;
    private engine: GameEngine;
    private hud: HUDRenderer;
    private lanes: LaneRenderer;
    private notes: NoteRenderer;
    private hitZone: HitZoneRenderer;
    private bg: BackgroundRenderer;
    private hitFeedback: HitFeedbackRenderer;
    private hitSounds: HitSoundService;

    private bloomFilter!: AdvancedBloomFilter;
    private crtFilter!: CRTFilter;
    private glitchFilter!: GlitchFilter;
    private glitchTimer: number = 0;
    private bloomSpike: number = 0;

    // Scene shake
    private shakeTime: number = 0;
    private shakeIntensity: number = 0;
    private baseShakeY: number = 0;

    constructor(app: Application, engine: GameEngine) {
        super();
        this.app = app;
        this.engine = engine;

        const width = app.screen.width;
        const height = app.screen.height;

        const mode = useGameStore.getState().mode;
        const laneCount = mode === 'trackpad' ? 1 : LANE_COUNT;

        // Use center 50% for lanes in classic, narrower area in trackpad mode
        const laneAreaWidth = width * (mode === 'trackpad' ? 0.2 : 0.5);
        const leftMargin = (width - laneAreaWidth) / 2;

        this.bg = new BackgroundRenderer(width, height);
        this.addChild(this.bg);

        this.lanes = new LaneRenderer(laneAreaWidth, height, laneCount);
        this.lanes.x = leftMargin;
        this.addChild(this.lanes);

        // Hit zone at 85% height
        const hitZoneY = height * 0.85;
        this.hitZone = new HitZoneRenderer(laneAreaWidth, hitZoneY, laneCount);
        this.hitZone.x = leftMargin;
        this.addChild(this.hitZone);

        // Calculate lane centers for note renderer
        const laneXPositions = [];
        const lw = this.lanes.getLaneWidth();
        for (let i = 0; i < laneCount; i++) {
            laneXPositions.push(leftMargin + i * lw + lw / 2);
        }

        this.notes = new NoteRenderer(laneXPositions, hitZoneY, -50);
        const g = new Graphics();
        g.moveTo(0, -15);
        g.lineTo(15, 0);
        g.lineTo(0, 15);
        g.lineTo(-15, 0);
        g.fill({ color: 0xffffff });
        const noteTexture = app.renderer.generateTexture(g);
        this.notes.init(noteTexture);

        this.addChild(this.notes);

        this.hitFeedback = new HitFeedbackRenderer(engine.events, laneXPositions, hitZoneY);
        this.addChild(this.hitFeedback);

        this.hud = new HUDRenderer(engine.events, width, height);
        this.addChild(this.hud);

        this.hitSounds = new HitSoundService();
        this.hitSounds.init();

        // Wire events
        this.engine.events.on('hit', this.onHit);
        this.engine.events.on('miss', this.onMiss);
        this.engine.events.on('combo-break', this.onComboBreak);
        this.engine.events.on('combo-milestone', this.onComboMilestone);

        // Start ticker
        this.app.ticker.add(this.update, this);

        const { bloom, crt, glitch } = applyGameEffects(this);
        this.bloomFilter = bloom;
        this.crtFilter = crt;
        this.glitchFilter = glitch;

        this.baseShakeY = this.y;
    }

    private onHit = (e: HitEvent) => {
        this.hitSounds.playHit(e.judgment);
        this.lanes.flashLane(e.lane);
        this.hitZone.flashPad(e.lane, e.judgment);

        if (e.judgment === 'perfect') {
            this.bloomSpike = 0.5;
        }
    };

    private onMiss = (e: MissEvent) => {
        this.hitSounds.playHit('miss');
        this.hitZone.flashPad(e.lane, 'miss');

        // Glitch
        this.glitchFilter.enabled = true;
        this.glitchTimer = 0;
        this.crtFilter.time += 5; // jump time for static noise

        // Shake
        this.shakeTime = 0.2; // 200ms
        this.shakeIntensity = 8;
    };

    private onComboMilestone = (e: ComboMilestoneEvent) => {
        this.hitSounds.playMilestone(e.combo);
    };

    private onComboBreak = () => {
        this.hitSounds.playComboBreak();
    };

    private update = () => {
        const currentTime = Tone.getTransport().seconds;
        this.engine.update(currentTime);

        const activeNotes = this.engine.getActiveNotes();
        this.crtFilter.time += this.app.ticker.deltaTime * 0.1;

        // Keep glitch effect short without creating frame-by-frame timers.
        if (this.glitchFilter.enabled) {
            this.glitchTimer += this.app.ticker.deltaMS / 1000;
            if (this.glitchTimer >= 0.1) {
                this.glitchFilter.enabled = false;
                this.glitchTimer = 0;
            }
        } else {
            this.glitchTimer = 0;
        }

        const state = useGameStore.getState();
        const time = state.currentTime;
        const dtSeconds = this.app.ticker.deltaMS / 1000;

        // Bloom spike decay
        if (this.bloomSpike > 0) {
            this.bloomFilter.brightness = 1.0 + this.bloomSpike * 2;
            this.bloomSpike = Math.max(0, this.bloomSpike - 5 * dtSeconds); // fast decay
        } else {
            this.bloomFilter.brightness = 1.0;
        }

        // Screen shake decay
        if (this.shakeTime > 0) {
            this.shakeTime -= dtSeconds;
            const displacement = (Math.random() - 0.5) * 2 * this.shakeIntensity * (this.shakeTime / 0.2);
            this.y = this.baseShakeY + displacement;
        } else {
            this.y = this.baseShakeY;
        }

        this.bg.update(dtSeconds);
        this.lanes.update(this.app.ticker.deltaTime); // Using deltaFrames for simple logic
        this.notes.update(time, activeNotes);
        this.hitFeedback.update(this.app.ticker.deltaTime);
        this.hud.update(this.app.ticker.deltaTime, state.score, state.combo, state.multiplier, this.app.screen.width);
        this.hitZone.update(time, this.app.ticker.deltaTime);
        this.hitZone.decayPads(this.app.ticker.deltaTime);
    };

    public destroy(options?: any) {
        this.engine.events.off('hit', this.onHit);
        this.engine.events.off('miss', this.onMiss);
        this.engine.events.off('combo-break', this.onComboBreak);
        this.engine.events.off('combo-milestone', this.onComboMilestone);
        this.app.ticker.remove(this.update, this);
        this.hitSounds.destroy();
        super.destroy(options);
    }
}
