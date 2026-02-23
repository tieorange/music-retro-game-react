import { Container, Graphics } from 'pixi.js';
import { LANE_COUNT } from '@/domain/constants';

export class LaneRenderer extends Container {
    private laneWidth: number;
    private renderHeight: number;
    private laneCount: number;
    private colors = [0x00ffff, 0xff00ff, 0xffff00, 0x00ff00];

    constructor(width: number, height: number, laneCount: number = LANE_COUNT) {
        super();
        this.laneCount = laneCount;
        this.laneWidth = width / laneCount;
        this.renderHeight = height;
        this.buildLanes(width);
    }

    private buildLanes(totalWidth: number) {
        // Dark background
        const bg = new Graphics();
        bg.rect(0, 0, totalWidth, this.renderHeight);
        bg.fill({ color: 0x0a0a1a, alpha: 0.8 });
        this.addChild(bg);

        for (let i = 0; i < this.laneCount; i++) {
            const laneX = i * this.laneWidth;

            // Divider line
            if (i > 0) {
                const divider = new Graphics();
                divider.rect(laneX - 1, 0, 2, this.renderHeight);
                divider.fill({ color: 0xffffff, alpha: 0.1 });
                this.addChild(divider);
            }

            // Border glow for each lane based on key color
            const glow = new Graphics();
            glow.rect(laneX + 2, 0, this.laneWidth - 4, this.renderHeight);
            glow.fill({ color: this.colors[i % this.colors.length], alpha: 0.05 });
            this.addChild(glow);
        }
    }

    public getLaneX(laneIndex: number): number {
        return laneIndex * this.laneWidth + this.laneWidth / 2;
    }

    public getLaneWidth(): number {
        return this.laneWidth;
    }
}
