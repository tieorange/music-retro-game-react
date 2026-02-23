import { ReactNode } from 'react';

interface LayoutProps {
    children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    return (
        <div className="relative w-screen h-screen overflow-hidden bg-game-bg text-white font-pixel flex flex-col">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/40 via-game-bg to-game-bg"></div>

            {/* Neon border frame effect */}
            <div className="absolute inset-4 pointer-events-none border border-slate-800/50 rounded-xl shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] z-0"></div>

            <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 lg:p-12 w-full max-w-screen-2xl mx-auto h-full">
                {children}
            </main>
        </div>
    );
}
