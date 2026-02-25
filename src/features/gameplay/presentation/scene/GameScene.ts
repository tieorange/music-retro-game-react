import { Container, Application } from 'pixi.js';
import * as Tone from 'tone';
import { GameEngine } from '../../application/GameEngine';
import { LaneRenderer } from './LaneRenderer';
import { NoteRenderer } from './NoteRenderer';
import { HitZoneRenderer } from './HitZoneRenderer';
import { BackgroundRenderer } from './BackgroundRenderer';
import { HUDRenderer } from './HUDRenderer';
import { HitFeedbackRenderer } from './HitFeedbackRenderer';
import { LANE_COUNT, HIT_ZONE_Y_RATIO, LANE_AREA_WIDTH_RATIO, TRACKPAD_LANE_AREA_RATIO, PORTRAIT_LANE_AREA_RATIO, PORTRAIT_TRACKPAD_LANE_AREA_RATIO } from '@/features/gameplay/domain/constants';
import { EffectsController } from './EffectsController';
import { GameEventListener } from './GameEventListener';

export class GameScene extends Container {
    private app: Application;
    private engine: GameEngine;
    private hud: HUDRenderer;
    private lanes: LaneRenderer;
    private notes: NoteRenderer;
    private hitZone: HitZoneRenderer;
    private bg: BackgroundRenderer;
    private hitFeedback: HitFeedbackRenderer;
    private effectsController: EffectsController;
    private listener: GameEventListener;

    constructor(app: Application, engine: GameEngine, mode: 'classic' | 'trackpad') {
        super();
        this.app = app;
        this.engine = engine;

        const width = app.screen.width;
        const height = app.screen.height;
        const isPortrait = height > width;

        const laneCount = mode === 'trackpad' ? 1 : LANE_COUNT;

        // Use wider area for lanes in portrait mode to ensure they are tappable
        let laneAreaRatio = mode === 'trackpad' ? TRACKPAD_LANE_AREA_RATIO : LANE_AREA_WIDTH_RATIO;
        if (isPortrait) {
            laneAreaRatio = mode === 'trackpad' ? PORTRAIT_TRACKPAD_LANE_AREA_RATIO : PORTRAIT_LANE_AREA_RATIO;
        }

        const laneAreaWidth = width * laneAreaRatio;
        const leftMargin = (width - laneAreaWidth) / 2;

        this.bg = new BackgroundRenderer(width, height);
        this.addChild(this.bg);

        this.lanes = new LaneRenderer(laneAreaWidth, height, laneCount);
        this.lanes.x = leftMargin;
        this.addChild(this.lanes);

        // Hit zone at 85% height
        const hitZoneY = height * HIT_ZONE_Y_RATIO;
        this.hitZone = new HitZoneRenderer(laneAreaWidth, hitZoneY, laneCount, engine.beatMap.bpm);
        this.hitZone.x = leftMargin;
        this.addChild(this.hitZone);

        // Calculate lane centers for note renderer
        const laneXPositions = [];
        const lw = this.lanes.getLaneWidth();
        for (let i = 0; i < laneCount; i++) {
            laneXPositions.push(leftMargin + i * lw + lw / 2);
        }

        const noteWidth = Math.min(lw * 0.8, 80);
        this.notes = new NoteRenderer(laneXPositions, hitZoneY, -50, noteWidth);
        this.notes.init();

        this.addChild(this.notes);

        this.hitFeedback = new HitFeedbackRenderer(engine.events, laneXPositions, hitZoneY);
        this.addChild(this.hitFeedback);

        this.hud = new HUDRenderer(engine.events, width, height);
        this.addChild(this.hud);

        this.effectsController = new EffectsController(this);
        this.listener = new GameEventListener(
            this.engine.events,
            this.engine.hitSounds,
            this.lanes,
            this.hitZone,
            this.effectsController
        );

        // Start ticker
        this.app.ticker.add(this.update, this);
    }

    private update = () => {
        const time = this.engine.currentTime;
        this.engine.update(time);

        const activeNotes = this.engine.getActiveNotes();
        const dtSeconds = this.app.ticker.deltaMS / 1000;
        const dtFrame = dtSeconds * 60;

        const isFever = this.engine.currentMultiplier >= 16;
        this.effectsController.setFever(isFever);
        this.bg.setFever(isFever);

        this.effectsController.update(dtSeconds);
        this.bg.update(dtSeconds);
        this.lanes.update(dtFrame);
        this.notes.update(time, activeNotes);
        this.hitFeedback.update(dtFrame);
        this.hud.update(
            dtFrame,
            this.engine.score,
            this.engine.currentCombo,
            this.engine.currentMultiplier,
            this.app.screen.width,
            this.engine.beatMap.bpm,
            Tone.Transport.seconds
        );
        this.hitZone.update(time, dtFrame);
        this.hitZone.decayPads(dtFrame);
    };

    public destroy(options?: any) {
        this.listener.destroy();
        this.app.ticker?.remove(this.update, this);
        super.destroy(options);
    }
}

