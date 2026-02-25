import { ReactNode } from 'react';

interface LayoutProps {
    children: ReactNode;
    fullscreen?: boolean;
}

export function Layout({ children, fullscreen = false }: LayoutProps) {
    if (fullscreen) {
        return (
            <div className="relative w-screen h-[100dvh] overflow-hidden bg-game-bg text-white font-pixel flex flex-col">
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/40 via-game-bg to-game-bg"></div>
                <div className="absolute inset-4 pointer-events-none border border-slate-800/50 rounded-xl shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] z-0"></div>
                <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-12 w-full max-w-screen-2xl mx-auto h-full">
                    {children}
                </main>
            </div>
        );
    }

    return (
        <div className="relative w-full h-[100dvh] overflow-hidden bg-game-bg text-white font-pixel flex flex-col">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/40 via-game-bg to-game-bg -z-10"></div>
            {/* Neon border frame — fixed so it stays in viewport on desktop; hidden on mobile */}
            <div className="absolute inset-4 pointer-events-none border border-slate-800/50 rounded-xl shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] z-[1] hidden sm:block"></div>
            <main className="relative z-10 flex-1 p-4 sm:p-6 lg:p-12 w-full max-w-screen-2xl mx-auto h-full overflow-y-auto overflow-x-hidden flex flex-col">
                <div className="w-full my-auto flex flex-col items-center justify-center pb-12 sm:pb-0">
                    {children}
                </div>
            </main>
        </div>
    );
}
