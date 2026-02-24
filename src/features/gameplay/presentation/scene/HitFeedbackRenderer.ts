import { Container, Text, TextStyle, Graphics } from 'pixi.js';
import { GameEventBus } from '../../domain/GameEventBus';
import { HitEvent, MissEvent, NearMissEvent, ComboMilestoneEvent, ComboBreakEvent } from '@/features/gameplay/domain/types';
import { JUDGMENT_COLORS } from '@/features/gameplay/domain/constants';

interface Particle {
    sprite: Graphics;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    gravity: number;
}

interface FloatingText {
    sprite: Text;
    vy: number;
    life: number;
    maxLife: number;
    scaleTarget: number;
    scaleSpeed: number;
}

export class HitFeedbackRenderer extends Container {
    private events: GameEventBus;
    private laneXPositions: number[];
    private hitZoneY: number;

    private particles: Particle[] = [];
    private texts: FloatingText[] = [];

    // Pools
    private particlePool: Graphics[] = [];
    private textPool: Text[] = [];
    private isMobile: boolean;

    // Pre-allocate styles
    private styles: Record<string, TextStyle> = {
        perfect: new TextStyle({ fontFamily: '"Press Start 2P", monospace', fontSize: 24, fill: 0xffd700, stroke: { color: 0xffffff, width: 2 }, dropShadow: { color: 0xffd700, blur: 5, distance: 0 } }),
        great: new TextStyle({ fontFamily: '"Press Start 2P", monospace', fontSize: 20, fill: 0x00ffff, dropShadow: { color: 0x00ffff, blur: 4, distance: 0 } }),
        good: new TextStyle({ fontFamily: '"Press Start 2P", monospace', fontSize: 16, fill: 0x00ff00 }),
        miss: new TextStyle({ fontFamily: '"Press Start 2P", monospace', fontSize: 20, fill: 0xff3333, dropShadow: { color: 0xff0000, blur: 8, distance: 0 } }),
        close: new TextStyle({ fontFamily: '"Press Start 2P", monospace', fontSize: 14, fill: 0xff9900 }),
        milestone: new TextStyle({ fontFamily: '"Press Start 2P", monospace', fontSize: 32, fill: 0xffffff, letterSpacing: 5, dropShadow: { color: 0xff00ff, blur: 10, distance: 0 } }),
        scorePopup: new TextStyle({ fontFamily: '"Press Start 2P", monospace', fontSize: 14, fill: 0xffffff }),
    };

    constructor(events: GameEventBus, laneXPositions: number[], hitZoneY: number) {
        super();
        this.events = events;
        this.laneXPositions = laneXPositions;
        this.hitZoneY = hitZoneY;
        this.isMobile = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

        // Pre-allocate pools
        for (let i = 0; i < 200; i++) {
            const g = new Graphics();
            g.rect(-3, -3, 6, 6);
            g.fill({ color: 0xffffff });
            this.particlePool.push(g);
        }

        for (let i = 0; i < 30; i++) {
            const t = new Text({ text: '', style: this.styles.good });
            t.anchor.set(0.5);
            this.textPool.push(t);
        }

        this.events.on('hit', this.onHit);
        this.events.on('miss', this.onMiss);
        this.events.on('near-miss', this.onNearMiss);
        this.events.on('combo-milestone', this.onMilestone);
        this.events.on('combo-break', this.onBreak);
    }

    public destroy(options?: any) {
        this.events.off('hit', this.onHit);
        this.events.off('miss', this.onMiss);
        this.events.off('near-miss', this.onNearMiss);
        this.events.off('combo-milestone', this.onMilestone);
        this.events.off('combo-break', this.onBreak);

        // Clear pools
        this.particlePool.forEach(p => p.destroy());
        this.particlePool = [];
        this.textPool.forEach(t => t.destroy());
        this.textPool = [];

        super.destroy(options);
    }

    private onHit = (e: HitEvent) => {
        const x = this.laneXPositions[e.lane];
        const y = this.hitZoneY;

        let textStr = '';
        let style = this.styles[e.judgment];
        let scoreVal = 0;

        if (e.judgment === 'perfect') {
            textStr = 'PERFECT!';
            scoreVal = 300;
            this.spawnParticles(x, y, 20, JUDGMENT_COLORS.perfect, 10, 'starburst');
        } else if (e.judgment === 'great') {
            textStr = 'GREAT';
            scoreVal = 200;
            this.spawnParticles(x, y, 12, JUDGMENT_COLORS.great, 8, 'fountain');
        } else if (e.judgment === 'good') {
            textStr = 'GOOD';
            scoreVal = 100;
            this.spawnParticles(x, y, 8, JUDGMENT_COLORS.good, 5, 'arc');
        }

        this.spawnText(x, y - 20, textStr, style, -1.0, 1.5, 0.8, 0.1);

        // Score popup
        let popupStr = `+${scoreVal}`;
        if (e.multiplier > 1) popupStr += ` x${e.multiplier}`;

        let customPopupStyle = new TextStyle({
            ...this.styles.scorePopup,
            fill: JUDGMENT_COLORS[e.judgment]
        });
        this.spawnText(x, y - 50, popupStr, customPopupStyle, -2.0, 1.0, 1.2, 0.1);
    };

    private onMiss = (e: MissEvent) => {
        const x = this.laneXPositions[e.lane];
        const y = this.hitZoneY;
        this.spawnText(x, y, 'MISS', this.styles.miss, 0, 0.5, 1.0, 0); // No float
        this.spawnParticles(x, y, 6, JUDGMENT_COLORS.miss, 6, 'down');
    };

    private onNearMiss = (e: NearMissEvent) => {
        const x = this.laneXPositions[e.lane];
        const y = this.hitZoneY;
        this.spawnText(x, y - 20, 'CLOSE...', this.styles.close, -0.5, 1.0, 1.0, 0);
    };

    private onMilestone = (e: ComboMilestoneEvent) => {
        const x = this.parent ? (this.parent as any).width / 2 : 400; // rough center
        this.spawnText(x, this.hitZoneY - 150, `COMBO x${e.combo}!`, this.styles.milestone, -0.2, 2.0, 1.5, 0.05);
    };

    private onBreak = (e: ComboBreakEvent) => {
        const x = this.parent ? (this.parent as any).width / 2 : 400;
        const scale = e.previousCombo > 20 ? 2.5 : 1.5;
        this.spawnText(x, this.hitZoneY - 100, `COMBO BROKEN`, this.styles.miss, 0.5, 1.0, scale, -0.1);
        if (e.previousCombo > 20) {
            this.spawnParticles(x, this.hitZoneY - 100, 30, JUDGMENT_COLORS.miss, 15, 'starburst');
        }
    };

    private spawnParticles(x: number, y: number, count: number, color: number, speed: number, shape: string) {
        if (this.isMobile) count = Math.ceil(count / 2);

        for (let i = 0; i < count; i++) {
            let g = this.particlePool.pop();
            if (!g) {
                g = new Graphics();
                g.rect(-3, -3, 6, 6);
                g.fill({ color: 0xffffff });
            }
            g.tint = color;
            g.x = x;
            g.y = y;
            g.alpha = 1;
            this.addChild(g);

            let vx = 0, vy = 0, grav = 0.2;

            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * speed + speed * 0.5;

            if (shape === 'starburst') {
                vx = Math.cos(angle) * velocity;
                vy = Math.sin(angle) * velocity;
            } else if (shape === 'fountain') {
                const fountainAngle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
                vx = Math.cos(fountainAngle) * velocity;
                vy = Math.sin(fountainAngle) * velocity;
                grav = 0.4;
            } else if (shape === 'arc') {
                const arcAngle = -Math.PI / 2 + (Math.random() - 0.5);
                vx = Math.cos(arcAngle) * velocity;
                vy = Math.sin(arcAngle) * velocity;
            } else if (shape === 'down') {
                const downAngle = Math.PI / 2 + (Math.random() - 0.5);
                vx = Math.cos(downAngle) * velocity;
                vy = Math.sin(downAngle) * velocity;
                grav = 0.5;
            }

            this.particles.push({
                sprite: g,
                vx, vy,
                life: 1.0, maxLife: 1.0,
                gravity: grav
            });
        }
    }

    private spawnText(x: number, y: number, str: string, style: TextStyle, vy: number, life: number, initialScale: number, scaleSpeed: number) {
        let text = this.textPool.pop();
        if (!text) {
            text = new Text({ text: '', style });
            text.anchor.set(0.5);
        }

        text.text = str;
        text.style = style;
        text.x = x;
        text.y = y;
        text.scale.set(initialScale);
        text.rotation = (Math.random() - 0.5) * 0.1;
        text.alpha = 1;
        this.addChild(text);

        this.texts.push({
            sprite: text,
            vy,
            life, maxLife: life,
            scaleTarget: 1.0,
            scaleSpeed
        });
    }

    public update(dt: number) {
        const deltaFrames = dt;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.vx *= 0.95;
            p.vy += p.gravity;
            p.sprite.x += p.vx * deltaFrames;
            p.sprite.y += p.vy * deltaFrames;

            p.life -= 0.02 * deltaFrames;
            p.sprite.alpha = Math.max(0, p.life / p.maxLife);

            if (p.life <= 0) {
                this.removeChild(p.sprite);
                this.particlePool.push(p.sprite);
                this.particles.splice(i, 1);
            }
        }

        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i];
            t.sprite.y += t.vy * deltaFrames;

            if (t.scaleSpeed !== 0) {
                const ds = t.scaleTarget - t.sprite.scale.x;
                t.sprite.scale.set(t.sprite.scale.x + ds * t.scaleSpeed * deltaFrames);
            }

            t.life -= 0.02 * deltaFrames;
            if (t.life < t.maxLife * 0.5) {
                t.sprite.alpha = Math.max(0, t.life / (t.maxLife * 0.5));
            }

            if (t.life <= 0) {
                this.removeChild(t.sprite);
                this.textPool.push(t.sprite);
                this.texts.splice(i, 1);
            }
        }
    }
}
