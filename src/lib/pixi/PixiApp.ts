import { Application } from 'pixi.js';

export async function createPixiApp(canvas: HTMLCanvasElement): Promise<Application> {
    const app = new Application();

    await app.init({
        canvas,
        width: 800,
        height: 600,
        antialias: false,
        backgroundColor: 0x0a0a1a,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
    });

    // Handle resizing to keep a 4:3 aspect ratio roughly, or just fit parent
    const resize = () => {
        const parent = canvas.parentElement;
        if (parent) {
            // Calculate responsive dimensions while maintaining aspect ratio or filling width
            const targetWidth = parent.clientWidth;
            const targetHeight = parent.clientHeight;

            app.renderer.resize(targetWidth, targetHeight);
        }
    };

    window.addEventListener('resize', resize);
    resize();

    return app;
}
