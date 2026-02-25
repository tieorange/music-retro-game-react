import { Container, Graphics, FillGradient } from 'pixi.js';
import { ActiveNote } from '../../domain/NoteTracker';
import { NOTE_FALL_DURATION, LANE_COLORS } from '@/features/gameplay/domain/constants';

class VisualNote extends Container {
    public body: Graphics;
    public glow: Graphics;
    public trail: Graphics;
    public isSpawned: boolean = false;
    public lifeTime: number = 0;

    constructor() {
        super();

        this.trail = new Graphics();
        this.addChild(this.trail);

        this.glow = new Graphics();
        this.addChild(this.glow);

        this.body = new Graphics();
        this.addChild(this.body);
    }

    public setup(color: number) {
        this.glow.clear();
        this.glow.circle(0, 0, 25);
        this.glow.fill({ color, alpha: 0.3 });
        this.glow.circle(0, 0, 16);
        this.glow.fill({ color, alpha: 0.6 });

        this.body.clear();
        const grad = new FillGradient(0, -10, 0, 10);
        grad.addColorStop(0, 0xffffff);
        grad.addColorStop(0.3, color);
        grad.addColorStop(1, 0x111122);

        this.body.roundRect(-24, -10, 48, 20, 10);
        this.body.fill(grad);
        this.body.stroke({ color: 0xffffff, width: 2, alpha: 0.8 });

        this.isSpawned = true;
        this.lifeTime = 0;
        this.scale.set(0); // Pop-in start
    }

    public updateTrail(color: number, length: number, isHold: boolean = false) {
        this.trail.clear();
        if (length <= 0) return;

        if (isHold) {
            this.trail.moveTo(-15, 0);
            this.trail.lineTo(15, 0);
            this.trail.lineTo(15, -length);
            this.trail.lineTo(-15, -length);
            this.trail.fill({ color, alpha: 0.6 });

            // Cap at the end of the note duration
            this.trail.rect(-20, -length - 5, 40, 10);
            this.trail.fill({ color: 0xffffff, alpha: 0.8 });
        } else {
            this.trail.moveTo(-10, 0);
            this.trail.lineTo(10, 0);
            this.trail.lineTo(2, -length);
            this.trail.lineTo(-2, -length);
            this.trail.fill({ color, alpha: 0.3 });
        }
    }
}

export class NoteRenderer extends Container {
    private pool: VisualNote[] = [];
    private activeSprites: Map<string, VisualNote> = new Map();
    private laneXPositions: number[];
    private hitZoneY: number;
    private spawnY: number;

    constructor(laneXPositions: number[], hitZoneY: number, spawnY: number) {
        super();
        this.laneXPositions = laneXPositions;
        this.hitZoneY = hitZoneY;
        this.spawnY = spawnY;
    }

    public init() {
        for (let i = 0; i < 50; i++) {
            this.pool.push(new VisualNote());
        }
    }

    public update(currentTime: number, activeNotes: ActiveNote[]) {

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
                    vNote = new VisualNote();
                }
                vNote.setup(color);
                vNote.x = this.laneXPositions[note.lane];

                // Fast-forward lifetime for notes that spawned early
                if (note.initialProgress) {
                    vNote.lifeTime = note.initialProgress * NOTE_FALL_DURATION;
                    vNote.scale.set(1); // skip pop-in
                }

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

            let currentY = this.spawnY + (this.hitZoneY - this.spawnY) * Math.max(0, Math.min(1, progress));
            if (note.type === 'hold' && note.isHeld) {
                currentY = this.hitZoneY;
            }
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
            let trailLength = 0;
            if (note.type === 'hold' && note.duration) {
                const durationPixels = (note.duration / NOTE_FALL_DURATION) * (this.hitZoneY - this.spawnY);
                if (note.isHeld) {
                    const heldTime = currentTime - note.time;
                    const remainingDuration = Math.max(0, note.duration - heldTime);
                    trailLength = (remainingDuration / NOTE_FALL_DURATION) * (this.hitZoneY - this.spawnY);
                } else {
                    trailLength = durationPixels;
                }
            } else {
                trailLength = 60 * progress;
            }
            vNote.updateTrail(color, trailLength, note.type === 'hold');
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
