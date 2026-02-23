import { useEffect } from 'react';
import { Layout } from '../shared-ui/Layout';
import { usePixiApp } from '@/lib/pixi/usePixiApp';
import { useGameEngine } from './engine/useGameEngine';
import { GameScene } from './scene/GameScene';
import { useInputManager } from './useInputManager';

export function GameplayScreen() {
    const { containerRef, app } = usePixiApp();
    const engine = useGameEngine();

    useInputManager(engine);

    useEffect(() => {
        if (!app || !engine) return;

        const scene = new GameScene(app, engine);
        app.stage.addChild(scene);

        return () => {
            app.stage.removeChild(scene);
            scene.destroy(true);
        };
    }, [app, engine]);

    return (
        <Layout>
            <div className="relative w-full h-full flex items-center justify-center">
                {/* The PIXI Canvas */}
                <div ref={containerRef} className="absolute inset-0 w-full h-full rounded-md overflow-hidden bg-black shadow-[0_0_30px_rgba(0,255,255,0.2)]" />

                {/* React overlays (Pause / Countdown) will go here */}
            </div>
        </Layout>
    );
}
