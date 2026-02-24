import { AdvancedBloomFilter, CRTFilter, GlitchFilter } from 'pixi-filters';
import { Container } from 'pixi.js';

export function applyGameEffects(stage: Container) {
    const isMobile = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

    const bloom = new AdvancedBloomFilter({
        threshold: 0.5,
        bloomScale: 1.5,
        brightness: 1.0,
        blur: isMobile ? 2 : 4,
    });

    const crt = new CRTFilter({
        curvature: 1.0,
        lineWidth: 1,
        lineContrast: 0.25,
        noise: 0.1,
        noiseSize: 1.5,
        vignetting: 0.3,
        vignettingAlpha: 0.8,
        vignettingBlur: 0.4,
        time: 0,
    });

    const glitch = new GlitchFilter({
        slices: 5,
        offset: 2,
        direction: 0,
        fillMode: 2,
        average: false,
    });
    glitch.enabled = false; // Add dynamically on misses

    // Note: in v8, filters array assignment is strict, might need to cast or apply directly
    if (isMobile) {
        stage.filters = [bloom] as any;
    } else {
        stage.filters = [bloom, crt, glitch] as any;
    }

    return { bloom, crt, glitch, isMobile };
}
