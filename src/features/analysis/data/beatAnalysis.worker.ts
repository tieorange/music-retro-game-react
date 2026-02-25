import { Essentia, EssentiaWASM } from 'essentia.js';

let essentia: any = null;

self.onmessage = async (e: MessageEvent) => {
    try {
        const { channelData, length } = e.data;

        if (!essentia) {
            // Vite's CommonJS interop sometimes wraps the loaded UMD module.
            const wasmModule = (EssentiaWASM as any).EssentiaWASM || EssentiaWASM;
            const essentiaClass = (Essentia as any).Essentia || Essentia;
            essentia = new essentiaClass(wasmModule);
        }

        // Mix to mono
        const mono = new Float32Array(length);
        const channels = channelData as Float32Array[];
        for (let i = 0; i < length; i++) {
            let sum = 0;
            for (const ch of channels) sum += ch[i];
            mono[i] = sum / channels.length;
        }

        const signal = essentia.arrayToVector(mono);

        // Execute essentia's BeatTrackerDegara algorithms
        const beats = essentia.BeatTrackerDegara(signal);
        const tempo = essentia.PercivalBpmEstimator(signal);

        const beatTimes = essentia.vectorToArray(beats.ticks || beats);
        const bpm = typeof tempo === 'object' && tempo.bpm ? tempo.bpm : tempo;

        // Cleanup vectors to prevent memory leaks in WASM
        if (signal && signal.delete) signal.delete();
        if (beats.ticks && beats.ticks.delete) beats.ticks.delete();
        else if (beats.delete) beats.delete();
        if (beats.confidence && beats.confidence.delete) beats.confidence.delete();
        if (tempo.ticks && tempo.ticks.delete) tempo.ticks.delete();

        self.postMessage({ beatTimes, bpm, success: true });
    } catch (err: any) {
        self.postMessage({ success: false, error: err.message + ' KEYS=' + (EssentiaWASM ? Object.keys(EssentiaWASM).join(',') : 'null') });
    }
};
