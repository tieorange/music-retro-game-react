import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { LANE_COUNT, LANE_COLORS, LANE_KEYS } from '@/domain/constants';

export class LaneRenderer extends Container {
    private laneWidth: number;
    private renderHeight: number;
    private laneCount: number;

    // Arrays for dynamic elements
    private laneGlows: Graphics[] = [];
    private laneTensions: Graphics[] = [];
    private keyLabels: Text[] = [];

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

        const labelStyle = new TextStyle({
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 10,
            fill: 0x666666,
        });

        for (let i = 0; i < this.laneCount; i++) {
            const laneX = i * this.laneWidth;

            // Divider line
            if (i > 0) {
                const divider = new Graphics();
                divider.rect(laneX - 1, 0, 2, this.renderHeight);
                divider.fill({ color: 0xffffff, alpha: 0.1 });
                this.addChild(divider);
            }

            // Tension glow
            const tension = new Graphics();
            tension.rect(laneX + 2, 0, this.laneWidth - 4, this.renderHeight);
            tension.fill({ color: LANE_COLORS[i % LANE_COLORS.length], alpha: 1.0 }); // Set base alpha to 1, we modulate graphic's alpha
            tension.alpha = 0;
            this.addChild(tension);
            this.laneTensions.push(tension);

            // Flash glow (on key press)
            const flash = new Graphics();
            flash.rect(laneX + 2, 0, this.laneWidth - 4, this.renderHeight);
            flash.fill({ color: 0xffffff, alpha: 1.0 });
            flash.alpha = 0;
            this.addChild(flash);
            this.laneGlows.push(flash);

            // Key label
            const label = new Text({ text: LANE_KEYS[i].toUpperCase(), style: labelStyle });
            label.anchor.set(0.5);
            label.x = laneX + this.laneWidth / 2;
            label.y = this.renderHeight * 0.85 + 20; // below hit zone defined in GameScene
            this.addChild(label);
            this.keyLabels.push(label);
        }
    }

    public update(dt: number) {
        for (let i = 0; i < this.laneGlows.length; i++) {
            const glow = this.laneGlows[i];
            if (glow.alpha > 0) {
                glow.alpha = Math.max(0, glow.alpha - 0.05 * dt);
                if (glow.alpha === 0) {
                    this.keyLabels[i].style.fill = 0x666666;
                }
            }

            const tension = this.laneTensions[i];
            if (tension.alpha > 0) {
                tension.alpha = Math.max(0, tension.alpha - 0.05 * dt);
            }
        }
    }

    public flashLane(laneIndex: number) {
        if (this.laneGlows[laneIndex]) {
            this.laneGlows[laneIndex].alpha = 0.4;
            this.keyLabels[laneIndex].style.fill = 0xffffff;
        }
    }

    public setLaneTension(laneIndex: number, amount: number) {
        if (this.laneTensions[laneIndex]) {
            this.laneTensions[laneIndex].alpha = Math.min(0.4, amount * 0.4);
        }
    }

    public getLaneX(laneIndex: number): number {
        return laneIndex * this.laneWidth + this.laneWidth / 2;
    }

    public getLaneWidth(): number {
        return this.laneWidth;
    }
}
