import { Container, Graphics } from 'pixi.js';

export class BackgroundRenderer extends Container {
    private grid: Graphics;
    private bgWidth: number;
    private bgHeight: number;
    private offsetY: number = 0;
    private speed: number = 100; // pixels per second

    constructor(width: number, height: number) {
        super();
        this.bgWidth = width;
        this.bgHeight = height;

        this.grid = new Graphics();
        this.addChild(this.grid);
    }

    public update(dt: number) {
        this.offsetY = (this.offsetY + this.speed * dt) % 40;
        this.drawGrid();
    }

    private drawGrid() {
        this.grid.clear();

        // Perspective grid (simplified orthographic for now, can be updated for perspective)
        this.grid.stroke({ width: 1, color: 0x8800ff, alpha: 0.3 });

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
