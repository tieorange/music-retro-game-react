import React, { useState } from 'react';
import { useYoutubeImport } from './useYoutubeImport';
import { Youtube, AlertCircle, Loader2 } from 'lucide-react';

interface YouTubeImportPanelProps {
    onImportComplete: (audioUrl: string, title: string) => void;
}

export const YouTubeImportPanel: React.FC<YouTubeImportPanelProps> = ({ onImportComplete }) => {
    const [url, setUrl] = useState('');
    const [licenseConfirmed, setLicenseConfirmed] = useState(false);
    const { startImport, status, progress, error, isImporting } = useYoutubeImport();

    const handleImport = async () => {
        if (!url || !licenseConfirmed) return;
        const result = await startImport(url, licenseConfirmed);
        if (result && result.track) {
            onImportComplete(result.track.audioUrl, result.track.title);
        }
    };

    return (
        <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-none border-2 border-neon-cyan shadow-[0_0_20px_rgba(0,255,255,0.2)] relative overflow-hidden group">
            {/* Decorative background element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-neon-cyan/20 rounded-lg">
                        <Youtube className="w-6 h-6 text-neon-cyan" />
                    </div>
                    <h3 className="text-2xl font-black italic tracking-tighter text-white uppercase">
                        YouTube <span className="text-neon-cyan">Loader</span>
                    </h3>
                </div>

                <div className="space-y-5">
                    <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">Target URL</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://www.youtube.com/watch?v=..."
                                className="w-full bg-black/40 border-b-2 border-slate-700 rounded-none px-4 py-3 text-neon-cyan placeholder:text-slate-600 focus:outline-none focus:border-neon-cyan transition-all font-mono text-sm"
                                disabled={isImporting}
                            />
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-white/5 border border-white/10">
                        <input
                            type="checkbox"
                            id="license-confirm"
                            checked={licenseConfirmed}
                            onChange={(e) => setLicenseConfirmed(e.target.checked)}
                            className="mt-1 accent-neon-cyan h-4 w-4"
                            disabled={isImporting}
                        />
                        <label htmlFor="license-confirm" className="text-[10px] leading-tight uppercase tracking-tight text-slate-300 select-none">
                            I certify that I have the legal right to use this audio. <br />
                            <span className="text-slate-500 italic mt-1 inline-block">PixelBeat assumes rights are held by the importer.</span>
                        </label>
                    </div>

                    <button
                        onClick={handleImport}
                        disabled={!url || !licenseConfirmed || isImporting}
                        className={`w-full py-4 rounded-none font-black text-sm uppercase tracking-[0.2em] transition-all relative overflow-hidden ${isImporting
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border-b-4 border-slate-900'
                                : 'bg-neon-cyan hover:bg-white text-black border-b-4 border-r-4 border-cyan-900 active:border-0 active:translate-y-1 active:translate-x-1 shadow-[0_5px_15px_rgba(0,255,255,0.3)]'
                            }`}
                    >
                        {isImporting ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing {progress}%
                            </span>
                        ) : 'Inject Audio'}
                    </button>

                    {status && (
                        <div className="flex items-center justify-center gap-2 py-2">
                            <div className="h-1 flex-1 bg-slate-800 overflow-hidden">
                                <div
                                    className="h-full bg-neon-cyan transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <span className="text-[10px] font-bold text-neon-cyan uppercase tracking-widest">{status}</span>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-500/50 text-red-400">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <p className="text-[10px] leading-tight uppercase font-bold">{error}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
