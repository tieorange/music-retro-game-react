import { Container, Application, Graphics } from 'pixi.js';
import { GameEngine } from '../engine/GameEngine';
import { LaneRenderer } from './LaneRenderer';
import { NoteRenderer } from './NoteRenderer';
import { HitZoneRenderer } from './HitZoneRenderer';
import { BackgroundRenderer } from './BackgroundRenderer';
import { HUDRenderer } from './HUDRenderer';
import { LANE_COUNT } from '@/domain/constants';
import { applyGameEffects } from './effects';
import { CRTFilter, GlitchFilter } from 'pixi-filters';
import * as Tone from 'tone';
import { useGameStore } from '@/shared/stores/gameStore';

export class GameScene extends Container {
    private app: Application;
    private engine: GameEngine;
    private hud: HUDRenderer;
    private lanes: LaneRenderer;
    private notes: NoteRenderer;
    private hitZone: HitZoneRenderer;
    private bg: BackgroundRenderer;
    private crtFilter!: CRTFilter;
    private glitchFilter!: GlitchFilter;
    private glitchTimer: number = 0;

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
        // In v8, generateTexture is on app.renderer
        const g = new Graphics();
        g.moveTo(0, -15);
        g.lineTo(15, 0);
        g.lineTo(0, 15);
        g.lineTo(-15, 0);
        g.fill({ color: 0xffffff });
        const noteTexture = app.renderer.generateTexture(g);
        this.notes.init(noteTexture);

        this.addChild(this.notes);

        this.hud = new HUDRenderer();

        // Position combo dynamically based on width
        const comboText = this.hud.children[1] as any;
        if (comboText) {
            comboText.x = width / 2;
        }

        this.addChild(this.hud);

        // Start ticker
        this.app.ticker.add(this.update, this);

        const { crt, glitch } = applyGameEffects(this);
        this.crtFilter = crt;
        this.glitchFilter = glitch;
    }

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

        this.bg.update(this.app.ticker.deltaTime / 60); // approx seconds
        this.notes.update(time, activeNotes);
        this.hud.update(state.score, state.combo, state.multiplier);
        this.hitZone.update(time);
    };

    public destroy(options?: any) {
        this.app.ticker.remove(this.update, this);
        super.destroy(options);
    }
}
