import { Container, Graphics } from 'pixi.js';
import { LANE_COUNT, LANE_COLORS, JUDGMENT_COLORS } from '@/domain/constants';
import { HitJudgment } from '@/domain/types';

interface Ring {
    sprite: Graphics;
    scale: number;
    alpha: number;
    color: number;
}

export class HitZoneRenderer extends Container {
    private bar: Graphics;
    private laneWidth: number;
    private pads: Graphics[] = [];
    private rings: Ring[] = [];

    constructor(width: number, y: number, laneCount: number = LANE_COUNT) {
        super();
        this.y = y;
        this.laneWidth = width / laneCount;

        // Base bar
        this.bar = new Graphics();
        this.bar.rect(0, -5, width, 10);
        this.bar.fill({ color: 0xffffff, alpha: 0.2 });

        // Bright top edge
        this.bar.moveTo(0, -5);
        this.bar.lineTo(width, -5);
        this.bar.stroke({ width: 2, color: 0xffffff, alpha: 0.8 });

        this.addChild(this.bar);

        // Pads
        const padWidth = this.laneWidth * 0.8;
        const padHeight = 12;

        for (let i = 0; i < laneCount; i++) {
            const pad = new Graphics();
            const px = i * this.laneWidth + (this.laneWidth - padWidth) / 2;
            pad.roundRect(px, -padHeight / 2, padWidth, padHeight, 4);
            pad.fill({ color: LANE_COLORS[i % LANE_COLORS.length], alpha: 0.4 });
            this.addChild(pad);
            this.pads.push(pad);
        }
    }

    public update(time: number, dt: number) {
        // Heartbeat - 30ms spike on beat, 150ms decay
        // Time is in seconds. Beat happens every integer time or based on Tone transport if synced.
        // For visual, a basic sin wave is easy, but a sharp sawtooth looks more like a heartbeat
        const beatPhase = time * (120 / 60); // assuming 120 bpm for now, ideally tied to real BPM
        const pulse = Math.max(0, 1 - (beatPhase % 1) * 3); // sharp decay
        this.bar.alpha = 0.5 + pulse * 0.5;

        // Update rings
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.scale += 0.05 * dt;
            r.alpha -= 0.05 * dt;

            r.sprite.scale.set(r.scale);
            r.sprite.alpha = r.alpha;

            if (r.alpha <= 0) {
                this.removeChild(r.sprite);
                r.sprite.destroy();
                this.rings.splice(i, 1);
            }
        }
    }

    public flashPad(lane: number, judgment: HitJudgment) {
        const pad = this.pads[lane];
        if (!pad) return;

        // Visual flash of the pad
        pad.alpha = 1.0;
        pad.scale.set(1.1);

        // Tween it back down (naive way, or use a tween engine, but we can just use an update loop if we store state)
        // For simplicity, we just set it high and let it stay, but actually we should decay it in update
        // Let's add an explicit decay in update:

        // Spawn ring
        const ring = new Graphics();
        ring.circle(0, 0, this.laneWidth * 0.4);
        ring.stroke({ width: 4, color: JUDGMENT_COLORS[judgment] || 0xffffff });
        ring.x = lane * this.laneWidth + this.laneWidth / 2;
        ring.y = 0;
        this.addChild(ring);

        this.rings.push({
            sprite: ring,
            scale: 1.0,
            alpha: 1.0,
            color: JUDGMENT_COLORS[judgment] || 0xffffff
        });
    }

    public decayPads(dt: number) {
        for (let i = 0; i < this.pads.length; i++) {
            const pad = this.pads[i];
            if (pad.alpha > 0.4) {
                pad.alpha -= 0.05 * dt;
            }
            if (pad.scale.x > 1.0) {
                const ns = pad.scale.x - 0.02 * dt;
                pad.scale.set(Math.max(1.0, ns));
            }
        }
    }
}
