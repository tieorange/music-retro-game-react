import { Essentia, EssentiaWASM } from 'essentia.js';

let essentia: any = null;

self.onmessage = async (e: MessageEvent) => {
    try {
        const { channelData, length } = e.data;

        if (!essentia) {
            essentia = new Essentia(await EssentiaWASM());
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

        const beatTimes = essentia.vectorToArray(beats.ticks);
        const bpm = tempo.bpm;

        // Cleanup vectors to prevent memory leaks in WASM
        signal.delete();
        beats.ticks.delete();
        beats.confidence.delete();

        self.postMessage({ beatTimes, bpm, success: true });
    } catch (err: any) {
        self.postMessage({ success: false, error: err.message });
    }
};
