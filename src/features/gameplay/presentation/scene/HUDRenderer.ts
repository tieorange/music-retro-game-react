import { Container, Text, TextStyle, Graphics } from 'pixi.js';
import { GameEventBus } from '../../domain/GameEventBus';

export class HUDRenderer extends Container {
    private scoreText: Text;
    private comboText: Text;
    private multiplierBanner: Graphics;
    private multiplierText: Text;
    private fcBadge: Text;
    private bpmText: Text;

    private targetScore: number = 0;
    private displayedScore: number = 0;

    private currentCombo: number = 0;
    private comboPulse: number = 0;
    private hasMissed: boolean = false;

    private scoreBounce: number = 0;

    constructor(events: GameEventBus, width: number, height: number) {
        super();

        const baseStyle = { fontFamily: '"Press Start 2P", monospace', fill: 0xffffff };
        const shadowDefaults = { alpha: 1, angle: Math.PI / 6, distance: 0 };

        this.scoreText = new Text({
            text: 'SCORE: 000000',
            style: new TextStyle({
                ...baseStyle,
                fontSize: 24,
                dropShadow: { color: 0xff00ff, blur: 5, ...shadowDefaults }
            })
        });
        this.scoreText.anchor.set(1, 0); // top right
        this.scoreText.x = width - 20;
        this.scoreText.y = 20;
        this.addChild(this.scoreText);

        this.comboText = new Text({
            text: '',
            style: new TextStyle({
                ...baseStyle,
                fontSize: 36,
                dropShadow: { color: 0x00ffff, blur: 10, ...shadowDefaults }
            })
        });
        this.comboText.anchor.set(0.5);
        this.comboText.x = width / 2;
        this.comboText.y = 100;
        this.addChild(this.comboText);

        this.fcBadge = new Text({
            text: 'FC',
            style: new TextStyle({
                ...baseStyle,
                fontSize: 16,
                fill: 0xffd700,
                dropShadow: { color: 0xffd700, blur: 8, ...shadowDefaults }
            })
        });
        this.fcBadge.x = 20;
        this.fcBadge.y = 20;
        this.addChild(this.fcBadge);

        this.bpmText = new Text({
            text: 'BPM',
            style: new TextStyle({
                ...baseStyle,
                fontSize: 14,
                fill: 0xffffff,
                dropShadow: { color: 0x00ffff, blur: 4, ...shadowDefaults }
            })
        });
        this.bpmText.x = 20;
        this.bpmText.y = height - 40;
        this.addChild(this.bpmText);

        this.multiplierBanner = new Graphics();
        this.addChild(this.multiplierBanner);

        this.multiplierText = new Text({
            text: '1X',
            style: new TextStyle({ ...baseStyle, fontSize: 20, fill: 0x0a0a1a })
        });
        this.multiplierText.anchor.set(0.5);
        this.addChild(this.multiplierText);

        // We use height inside the class for consistency or future layout logic
        if (height < 0) console.log(height);

        events.on('miss', () => {
            if (!this.hasMissed) {
                this.hasMissed = true;
                this.fcBadge.alpha = 0;
            }
        });
    }

    public update(dt: number, realScore: number, combo: number, multiplier: number, width: number, bpm: number, transportSeconds: number) {
        // Pulse BPM text based on transport time
        const bps = bpm / 60;
        const beatPhase = (transportSeconds * bps) % 1; // 0 to 1 over one beat
        const pulse = Math.max(0, 1 - beatPhase * 4) * 0.2; // sharp spike at the start of the beat

        this.bpmText.text = `BPM: ${Math.round(bpm)}`;
        this.bpmText.scale.set(1 + pulse);
        // Score lerp & bounce
        if (realScore > this.targetScore) {
            this.targetScore = realScore;
            this.scoreBounce = 0.15; // bounce trigger
        }

        if (this.displayedScore < this.targetScore) {
            this.displayedScore += Math.max(1, (this.targetScore - this.displayedScore) * 0.2);
            if (this.targetScore - this.displayedScore < 1) this.displayedScore = this.targetScore;
        }

        this.scoreText.text = `SCORE: ${Math.floor(this.displayedScore).toString().padStart(6, '0')}`;

        if (this.scoreBounce > 0) {
            this.scoreText.scale.set(1.0 + this.scoreBounce);
            this.scoreBounce = Math.max(0, this.scoreBounce - 0.02 * dt);
        }

        // Combo text logic
        if (combo >= 10) {
            this.comboText.text = `${combo} COMBO`;

            if (combo !== this.currentCombo) {
                this.comboPulse = 0.2;
            }
            const scaleBase = combo >= 50 ? 1.5 : (combo >= 30 ? 1.2 : 1.0);
            this.comboText.scale.set(scaleBase + this.comboPulse);
            this.comboPulse = Math.max(0, this.comboPulse - 0.05 * dt);

            // Colors
            if (combo >= 100) this.comboText.style.fill = 0xffffff; // rainbow logic handled elsewhere or later
            else if (combo >= 50) this.comboText.style.fill = 0xffd700;
            else if (combo >= 30) this.comboText.style.fill = 0xff00ff;
            else this.comboText.style.fill = 0x00ffff;

            this.comboText.style.dropShadow = {
                color: this.comboText.style.fill as number,
                blur: combo >= 50 ? 20 : 10,
                distance: 0,
                alpha: 1, angle: Math.PI / 6
            };
        } else {
            this.comboText.text = '';
        }
        this.currentCombo = combo;

        // Multiplier positioning around combo text
        if (combo >= 10) {
            this.multiplierText.alpha = 1;
            this.multiplierBanner.alpha = 1;

            // Orbit calculation
            const timeObj = performance.now() / 1000;
            const radiusX = 120 + (combo >= 50 ? 40 : 0);
            const radiusY = 40 + (combo >= 50 ? 20 : 0);
            const bx = (width / 2) + Math.cos(timeObj * 3) * radiusX;
            const by = 100 + Math.sin(timeObj * 3) * radiusY;

            this.multiplierText.x = bx;
            this.multiplierText.y = by;
            let bannerColor = 0xffffff;
            let bannerWidth = 60;
            let bannerText = `${multiplier}X`;

            if (multiplier === 2) bannerColor = 0x00ff00;
            if (multiplier === 4) bannerColor = 0x00ffff;
            if (multiplier === 8) bannerColor = 0xff00ff;
            if (multiplier >= 16) {
                bannerColor = 0xffd700;
                bannerWidth = 100;
                bannerText = "FEVER!";
            }

            this.multiplierText.text = bannerText;

            this.multiplierBanner.clear();
            this.multiplierBanner.rect(bx - bannerWidth / 2, by - 15, bannerWidth, 30);
            this.multiplierBanner.fill({ color: bannerColor });
        } else {
            this.multiplierText.alpha = 0;
            this.multiplierBanner.alpha = 0;
        }
    }
}
