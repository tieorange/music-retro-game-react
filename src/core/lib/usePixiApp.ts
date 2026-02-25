import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import { createPixiApp } from './PixiApp';

export function usePixiApp() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [app, setApp] = useState<Application | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        let isDestroyed = false;
        let localApp: Application | null = null;
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';

        // Make it relative to the container
        containerRef.current.appendChild(canvas);

        let cleanupFn: (() => void) | null = null;
        createPixiApp(canvas).then(({ app: pixiApp, cleanup }) => {
            if (isDestroyed) {
                cleanup();
                pixiApp.destroy(true, { children: true, texture: false });
                return;
            }
            localApp = pixiApp;
            cleanupFn = cleanup;
            setApp(pixiApp);
        });

        return () => {
            isDestroyed = true;
            if (cleanupFn) cleanupFn();
            if (localApp) {
                localApp.destroy(true, { children: true, texture: false });
            } else if (canvas.parentElement) {
                canvas.remove();
            }
        };
    }, []);

    return { containerRef, app };
}
