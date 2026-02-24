import { Container, Graphics } from 'pixi.js';

export class BackgroundRenderer extends Container {
    private grid: Graphics;
    private bgWidth: number;
    private bgHeight: number;
    private offsetY: number = 0;
    private speed: number = 100; // pixels per second
    private isFever: boolean = false;
    private feverHue: number = 0;

    constructor(width: number, height: number) {
        super();
        this.bgWidth = width;
        this.bgHeight = height;

        this.grid = new Graphics();
        this.addChild(this.grid);
    }

    public setFever(isFever: boolean) {
        if (!this.isFever && isFever) {
            this.feverHue = 0;
            this.speed = 200; // Double speed during fever
        } else if (this.isFever && !isFever) {
            this.speed = 100; // Normal speed
        }
        this.isFever = isFever;
    }

    public update(dt: number) {
        this.offsetY = (this.offsetY + this.speed * dt) % 40;
        if (this.isFever) {
            this.feverHue = (this.feverHue + dt * 180) % 360;
        }
        this.drawGrid();
    }

    // Helper to convert HSL to RGB Hex
    private hslToHex(h: number, s: number, l: number): number {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = (n: number) => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return parseInt(`0x${f(0)}${f(8)}${f(4)}`);
    }

    private drawGrid() {
        this.grid.clear();

        const gridColor = this.isFever ? this.hslToHex(this.feverHue, 100, 50) : 0x8800ff;
        const gridAlpha = this.isFever ? 0.6 : 0.3;

        // Perspective grid (simplified orthographic for now, can be updated for perspective)
        this.grid.stroke({ width: this.isFever ? 2 : 1, color: gridColor, alpha: gridAlpha });

        // Vertical lines
        for (let x = 0; x <= this.bgWidth; x += 40) {
            this.grid.moveTo(x, 0);
            this.grid.lineTo(x, this.bgHeight);
        }

        // Horizontal moving lines
        for (let y = this.offsetY; y <= this.bgHeight; y += 40) {
            this.grid.moveTo(0, y);
            this.grid.lineTo(this.bgWidth, y);
        }
    }
}
