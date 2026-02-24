import { Container } from 'pixi.js';
import { AdvancedBloomFilter, CRTFilter, GlitchFilter } from 'pixi-filters';
import { applyGameEffects } from './effects';
import { BLOOM_SPIKE_INITIAL, SHAKE_DURATION, SHAKE_INTENSITY, GLITCH_DURATION } from '@/features/gameplay/domain/constants';

export class EffectsController {
    private target: Container;
    private bloomFilter: AdvancedBloomFilter;
    private crtFilter: CRTFilter;
    private glitchFilter: GlitchFilter;

    private glitchTimer: number = 0;
    private bloomSpike: number = 0;
    private shakeTime: number = 0;
    private shakeIntensity: number = 0;
    private baseShakeY: number = 0;
    private isMobile: boolean;
    private baseBloom: number = 1.0;

    constructor(target: Container) {
        this.target = target;
        this.baseShakeY = target.y;

        const { bloom, crt, glitch, isMobile } = applyGameEffects(target);
        this.bloomFilter = bloom;
        this.crtFilter = crt;
        this.glitchFilter = glitch;
        this.isMobile = isMobile;
    }

    public setFever(isFever: boolean) {
        this.baseBloom = isFever ? 2.0 : 1.0;
    }

    public update(dtSeconds: number) {
        // CRT
        if (!this.isMobile) {
            this.crtFilter.time += dtSeconds * 6; // app.ticker.deltaTime * 0.1 at 60fps is roughly dtSeconds * 6
        }

        // Glitch
        if (!this.isMobile && this.glitchFilter.enabled) {
            this.glitchTimer += dtSeconds;
            if (this.glitchTimer >= GLITCH_DURATION) {
                this.glitchFilter.enabled = false;
                this.glitchTimer = 0;
            }
        } else {
            this.glitchTimer = 0;
        }

        // Bloom
        if (this.bloomSpike > 0) {
            this.bloomFilter.brightness = this.baseBloom + this.bloomSpike * 2;
            this.bloomSpike = Math.max(0, this.bloomSpike - 5 * dtSeconds); // fast decay
        } else {
            this.bloomFilter.brightness = this.baseBloom;
        }

        // Shake
        if (this.shakeTime > 0) {
            this.shakeTime -= dtSeconds;
            const displacement = (Math.random() - 0.5) * 2 * this.shakeIntensity * (this.shakeTime / SHAKE_DURATION);
            this.target.y = this.baseShakeY + displacement;
        } else {
            this.target.y = this.baseShakeY;
        }
    }

    public triggerHit(judgment: string) {
        if (judgment === 'perfect') {
            this.bloomSpike = BLOOM_SPIKE_INITIAL;
        }
    }

    public triggerMiss() {
        if (!this.isMobile) {
            this.glitchFilter.enabled = true;
            this.glitchTimer = 0;
            this.crtFilter.time += 5; // jump time for static noise
        }
        this.shakeTime = SHAKE_DURATION;
        this.shakeIntensity = SHAKE_INTENSITY;
    }

    public triggerHeavyMiss() {
        if (!this.isMobile) {
            this.glitchFilter.enabled = true;
            this.glitchTimer = -0.3; // Longer glitch
            this.crtFilter.time += 15;
        }
        this.shakeTime = SHAKE_DURATION * 1.5;
        this.shakeIntensity = SHAKE_INTENSITY * 2.5;
    }
}
