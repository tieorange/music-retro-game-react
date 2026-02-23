import { Container, Graphics } from 'pixi.js';
import { LANE_COUNT } from '@/domain/constants';

export class HitZoneRenderer extends Container {
    private bar: Graphics;

    constructor(width: number, y: number, laneCount: number = LANE_COUNT) {
        super();
        this.y = y;

        this.bar = new Graphics();
        this.bar.rect(0, -5, width, 10);
        this.bar.fill({ color: 0xffffff, alpha: 0.8 });

        // Add glowing border
        this.bar.rect(0, -8, width, 16);
        this.bar.stroke({ width: 2, color: 0x00ffff, alpha: 0.5 });

        this.addChild(this.bar);

        // Hit indicators for each lane
        const laneWidth = width / laneCount;
        const colors = [0x00ffff, 0xff00ff, 0xffff00, 0x00ff00];

        for (let i = 0; i < laneCount; i++) {
            const indicator = new Graphics();
            indicator.circle(laneWidth * i + laneWidth / 2, 0, 8);
            indicator.stroke({ width: 2, color: colors[i % colors.length] });
            this.addChild(indicator);
        }
    }

    public update(time: number) {
        // Subtle pulsing
        const pulse = 0.8 + Math.sin(time * 10) * 0.2;
        this.bar.alpha = pulse;
    }

    public flashLane(_lane: number) {
        // This will be expanded in Phase 7 Effects
        // For now we could just enlarge the indicator
    }
}
