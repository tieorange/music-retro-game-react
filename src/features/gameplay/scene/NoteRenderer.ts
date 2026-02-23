import { Container, Texture, Graphics, Sprite } from 'pixi.js';
import { ActiveNote } from '../engine/NoteTracker';
import { SpritePool } from './SpritePool';
import { NOTE_FALL_DURATION } from '@/domain/constants';

export class NoteRenderer extends Container {
    private pool!: SpritePool;
    private activeSprites: Map<string, Sprite> = new Map();
    private laneXPositions: number[];
    private hitZoneY: number;
    private spawnY: number;

    constructor(laneXPositions: number[], hitZoneY: number, spawnY: number) {
        super();
        this.laneXPositions = laneXPositions;
        this.hitZoneY = hitZoneY;
        this.spawnY = spawnY;

        // Create a simple diamond texture for notes
        const g = new Graphics();
        g.moveTo(0, -15);
        g.lineTo(15, 0);
        g.lineTo(0, 15);
        g.lineTo(-15, 0);
        g.fill({ color: 0xffffff });

        // Create texture from graphics (works differently in v8, maybe use app.renderer.generateTexture, 
        // but for now we'll do this on the fly or pass a texture into the constructor)
        // Actually, Graphics can directly generate texture in v8
    }

    // We need to pass the texture in because generating it requires the renderer
    public init(texture: Texture) {
        this.pool = new SpritePool(texture, 100);
    }

    public update(currentTime: number, activeNotes: ActiveNote[]) {
        if (!this.pool) return;

        // Track which notes are still active this frame
        const currentFrameNotes = new Set<string>();

        for (const note of activeNotes) {
            currentFrameNotes.add(note.id);

            let sprite = this.activeSprites.get(note.id);
            if (!sprite) {
                sprite = this.pool.acquire();
                // Setup initial state
                sprite.x = this.laneXPositions[note.lane];
                sprite.tint = this.getLaneColor(note.lane);

                this.addChild(sprite);
                this.activeSprites.set(note.id, sprite);
            }

            // Calculate vertical position
            const timeUntilHit = note.time - currentTime;
            const progress = 1 - (timeUntilHit / NOTE_FALL_DURATION);

            // lerp Y
            const currentY = this.spawnY + (this.hitZoneY - this.spawnY) * progress;
            sprite.y = currentY;

            // Pulse effect as it gets closer
            if (progress > 0.8 && progress < 1.0) {
                const pulse = 1 + Math.sin(progress * Math.PI * 10) * 0.1;
                sprite.scale.set(pulse);
            } else {
                sprite.scale.set(1);
            }
        }

        // Release sprites for notes that are no longer active
        for (const [id, sprite] of Array.from(this.activeSprites.entries())) {
            if (!currentFrameNotes.has(id)) {
                this.removeChild(sprite);
                this.pool.release(sprite);
                this.activeSprites.delete(id);
            }
        }
    }

    private getLaneColor(lane: number): number {
        const colors = [0x00ffff, 0xff00ff, 0xffff00, 0x00ff00];
        return colors[lane] ?? colors[0];
    }
}
