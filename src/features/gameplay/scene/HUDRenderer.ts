import { Container, Text, TextStyle, Graphics } from 'pixi.js';

export class HUDRenderer extends Container {
    private scoreText: Text;
    private comboText: Text;
    private multiplierBanner: Graphics;
    private multiplierText: Text;
    private comboPulse: number = 0;
    private previousCombo: number = 0;

    constructor() {
        super();

        // Use a standard style but fallback to loaded Press Start 2P if possible
        const titleStyle = new TextStyle({
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 24,
            fill: 0xffffff,
            dropShadow: {
                color: 0xff00ff,
                blur: 5,
                distance: 0,
            }
        });

        this.scoreText = new Text({ text: 'SCORE: 0', style: titleStyle });
        this.scoreText.x = 20;
        this.scoreText.y = 20;
        this.addChild(this.scoreText);

        const comboStyle = new TextStyle({
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 36,
            fill: 0x00ffff,
            dropShadow: {
                color: 0x00ffff,
                blur: 10,
                distance: 0,
            }
        });

        this.comboText = new Text({ text: '', style: comboStyle });
        // Center roughly
        this.comboText.x = 400; // Will be dynamic, handled in update
        this.comboText.y = 100;
        this.comboText.anchor.set(0.5);
        this.addChild(this.comboText);

        // Multiplier banner
        this.multiplierBanner = new Graphics();
        this.multiplierBanner.x = 650;
        this.multiplierBanner.y = 30;
        this.addChild(this.multiplierBanner);

        const multStyle = new TextStyle({
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 20,
            fill: 0x0a0a1a,
        });
        this.multiplierText = new Text({ text: '1X', style: multStyle });
        this.multiplierText.anchor.set(0.5);
        this.multiplierText.x = 650;
        this.multiplierText.y = 30;
        this.addChild(this.multiplierText);
    }

    public update(score: number, combo: number, multiplier: number) {
        this.scoreText.text = `SCORE: ${score.toString().padStart(6, '0')}`;

        if (combo >= 10) {
            this.comboText.text = `${combo} COMBO`;
            if (combo > this.previousCombo) {
                this.comboPulse = 0.18;
            }
            const scale = 1 + this.comboPulse;
            this.comboText.scale.set(scale);
            this.comboPulse = Math.max(0, this.comboPulse - 0.06);
        } else {
            this.comboText.text = '';
            this.comboText.scale.set(1);
            this.comboPulse = 0;
        }
        this.previousCombo = combo;

        this.multiplierText.text = `${multiplier}X`;

        // Draw banner
        this.multiplierBanner.clear();
        let bannerColor = 0xffffff;
        if (multiplier === 2) bannerColor = 0x00ff00;
        if (multiplier === 4) bannerColor = 0x00ffff;
        if (multiplier === 8) bannerColor = 0xff00ff;

        this.multiplierBanner.rect(-40, -20, 80, 40);
        this.multiplierBanner.fill({ color: bannerColor });
    }
}
