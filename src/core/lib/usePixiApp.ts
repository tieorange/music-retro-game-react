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

        createPixiApp(canvas).then((pixiApp) => {
            if (isDestroyed) {
                pixiApp.destroy(true, { children: true, texture: false });
                return;
            }
            localApp = pixiApp;
            setApp(pixiApp);
        });

        return () => {
            isDestroyed = true;
            if (localApp) {
                localApp.destroy(true, { children: true, texture: false });
            } else if (canvas.parentElement) {
                canvas.remove();
            }
        };
    }, []);

    return { containerRef, app };
}
