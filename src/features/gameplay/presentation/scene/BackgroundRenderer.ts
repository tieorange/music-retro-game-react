import { Container, Graphics, FillGradient } from 'pixi.js';

export class BackgroundRenderer extends Container {
    private grid: Graphics;
    private stars: Graphics;
    private vignette: Graphics;
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

        this.stars = new Graphics();
        this.addChild(this.stars);

        this.grid = new Graphics();
        this.addChild(this.grid);

        this.vignette = new Graphics();
        this.addChild(this.vignette);

        this.buildStars();
        this.buildVignette();
    }

    private buildStars() {
        this.stars.fill({ color: 0xffffff, alpha: 0.5 });
        for (let i = 0; i < 150; i++) {
            const x = Math.random() * this.bgWidth;
            const y = Math.random() * this.bgHeight;
            const size = Math.random() * 2 + 1;
            this.stars.circle(x, y, size);
            this.stars.circle(x, y - this.bgHeight, size); // Seamless clone above
        }
        this.stars.fill();
    }

    private buildVignette() {
        const width = this.bgWidth;
        const height = this.bgHeight;

        // Simulate radial vignette with 4 directional gradients
        const vGradLeft = new FillGradient(0, 0, width * 0.25, 0);
        vGradLeft.addColorStop(0, 'rgba(0,0,0,0.85)');
        vGradLeft.addColorStop(1, 'rgba(0,0,0,0)');
        this.vignette.rect(0, 0, width * 0.25, height).fill(vGradLeft);

        const vGradRight = new FillGradient(width, 0, width * 0.75, 0);
        vGradRight.addColorStop(0, 'rgba(0,0,0,0.85)');
        vGradRight.addColorStop(1, 'rgba(0,0,0,0)');
        this.vignette.rect(width * 0.75, 0, width * 0.25, height).fill(vGradRight);

        const vGradTop = new FillGradient(0, 0, 0, height * 0.2);
        vGradTop.addColorStop(0, 'rgba(0,0,0,0.8)');
        vGradTop.addColorStop(1, 'rgba(0,0,0,0)');
        this.vignette.rect(0, 0, width, height * 0.2).fill(vGradTop);

        const vGradBottom = new FillGradient(0, height, 0, height * 0.8);
        vGradBottom.addColorStop(0, 'rgba(0,0,0,0.9)');
        vGradBottom.addColorStop(1, 'rgba(0,0,0,0)');
        this.vignette.rect(0, height * 0.8, width, height * 0.2).fill(vGradBottom);
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
        // Grid scroll
        this.offsetY = (this.offsetY + this.speed * dt) % 40;

        // Stars scroll (parallax)
        this.stars.y += (this.speed * 0.15) * dt;
        if (this.stars.y >= this.bgHeight) {
            this.stars.y -= this.bgHeight;
        }

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
