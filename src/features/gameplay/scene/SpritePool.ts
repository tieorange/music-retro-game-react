import { Sprite, Texture } from 'pixi.js';

export class SpritePool {
    private pool: Sprite[] = [];
    private active: Set<Sprite> = new Set();
    private texture: Texture;

    constructor(texture: Texture, initialSize: number = 50) {
        this.texture = texture;
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createSprite());
        }
    }

    private createSprite(): Sprite {
        const sprite = new Sprite(this.texture);
        sprite.visible = false;
        sprite.anchor.set(0.5);
        return sprite;
    }

    public acquire(): Sprite {
        let sprite = this.pool.pop();
        if (!sprite) {
            sprite = this.createSprite();
        }
        sprite.visible = true;
        sprite.scale.set(1);
        sprite.alpha = 1;
        sprite.tint = 0xffffff;
        this.active.add(sprite);
        return sprite;
    }

    public release(sprite: Sprite): void {
        if (this.active.has(sprite)) {
            sprite.visible = false;
            this.active.delete(sprite);
            this.pool.push(sprite);
        }
    }

    public getActiveCount(): number {
        return this.active.size;
    }
}
