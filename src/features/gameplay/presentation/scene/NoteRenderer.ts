import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { ActiveNote } from '../../domain/NoteTracker';
import { NOTE_FALL_DURATION, LANE_COLORS } from '@/features/gameplay/domain/constants';

class VisualNote extends Container {
    public sprite: Sprite;
    public glow: Graphics;
    public trail: Graphics;
    public isSpawned: boolean = false;
    public lifeTime: number = 0;

    constructor(texture: Texture) {
        super();

        this.trail = new Graphics();
        this.addChild(this.trail);

        this.glow = new Graphics();
        this.addChild(this.glow);

        this.sprite = new Sprite(texture);
        this.sprite.anchor.set(0.5);
        this.addChild(this.sprite);
    }

    public setup(color: number) {
        this.sprite.tint = color;
        this.glow.clear();
        this.glow.circle(0, 0, 20);
        this.glow.fill({ color, alpha: 0.4 });
        this.isSpawned = true;
        this.lifeTime = 0;
        this.scale.set(0); // Pop-in start
    }

    public updateTrail(color: number, length: number) {
        this.trail.clear();
        // Draw a gradient-like trail. Pixi v8 handles gradients differently, 
        // so we can just draw a polygon with varying alpha or multiple rects.
        // For simplicity, a simple polygon extending up:
        this.trail.moveTo(-10, 0);
        this.trail.lineTo(10, 0);
        this.trail.lineTo(2, -length);
        this.trail.lineTo(-2, -length);
        this.trail.fill({ color, alpha: 0.3 });
    }
}

export class NoteRenderer extends Container {
    private pool: VisualNote[] = [];
    private activeSprites: Map<string, VisualNote> = new Map();
    private laneXPositions: number[];
    private hitZoneY: number;
    private spawnY: number;
    private noteTexture!: Texture;

    constructor(laneXPositions: number[], hitZoneY: number, spawnY: number) {
        super();
        this.laneXPositions = laneXPositions;
        this.hitZoneY = hitZoneY;
        this.spawnY = spawnY;
    }

    public init(texture: Texture) {
        this.noteTexture = texture;
        for (let i = 0; i < 50; i++) {
            this.pool.push(new VisualNote(texture));
        }
    }

    public update(currentTime: number, activeNotes: ActiveNote[]) {
        if (!this.noteTexture) return;

        const currentFrameNotes = new Set<string>();

        // Time delta for pop-in animation (assuming 60fps)
        const dt = 1 / 60;

        for (const note of activeNotes) {
            currentFrameNotes.add(note.id);

            let vNote = this.activeSprites.get(note.id);
            const color = this.getLaneColor(note.lane);

            if (!vNote) {
                if (this.pool.length > 0) {
                    vNote = this.pool.pop()!;
                } else {
                    vNote = new VisualNote(this.noteTexture);
                }
                vNote.setup(color);
                vNote.x = this.laneXPositions[note.lane];
                this.addChild(vNote);
                this.activeSprites.set(note.id, vNote);
            }

            vNote.lifeTime += dt;

            // Calculate vertical position
            const timeUntilHit = note.time - currentTime;
            const progress = 1 - (timeUntilHit / NOTE_FALL_DURATION);

            // Wait, if progress < 0, note hasn't spawned yet visually (it spawns early in tracker)
            // But NoteTracker sets spawnTime = time - NOTE_FALL_DURATION. 
            // So progress is 0 at spawn time, 1 at hit time.

            const currentY = this.spawnY + (this.hitZoneY - this.spawnY) * Math.max(0, progress);
            vNote.y = currentY;

            // Approach fade
            vNote.alpha = Math.min(1.0, 0.3 + (progress * 1.4));

            // Pop-in animation
            if (vNote.lifeTime < 0.04) {
                const scaleProgress = vNote.lifeTime / 0.04;
                vNote.scale.set(scaleProgress * 1.2);
            } else if (vNote.lifeTime < 0.08) {
                const bounceBack = 1.2 - ((vNote.lifeTime - 0.04) / 0.04) * 0.2;
                vNote.scale.set(bounceBack);
            } else {
                vNote.scale.set(1);
            }

            // Danger flash (last 100ms)
            vNote.glow.alpha = 0.4; // reset
            if (timeUntilHit < 0.1 && timeUntilHit > -0.15) {
                // Flash red rapidly
                const flash = Math.floor(currentTime * 20) % 2 === 0;
                if (flash) {
                    vNote.glow.clear();
                    vNote.glow.circle(0, 0, 25);
                    vNote.glow.fill({ color: 0xff0000, alpha: 0.8 });
                } else {
                    vNote.setup(color); // reset
                }
            } else {
                // Normal pulse as it approaches
                if (progress > 0.8 && progress < 1.0) {
                    const pulse = 1 + Math.sin(progress * Math.PI * 10) * 0.1;
                    vNote.scale.set(pulse);
                }
            }

            // Update trail length
            const trailLength = 60 * progress;
            vNote.updateTrail(color, trailLength);
        }

        for (const [id, vNote] of Array.from(this.activeSprites.entries())) {
            if (!currentFrameNotes.has(id)) {
                this.removeChild(vNote);
                this.pool.push(vNote);
                this.activeSprites.delete(id);
            }
        }
    }

    private getLaneColor(lane: number): number {
        return LANE_COLORS[lane % LANE_COLORS.length] ?? 0xffffff;
    }
}
