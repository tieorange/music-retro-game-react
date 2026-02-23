// Listen for messages from the main thread
self.onmessage = async (e) => {
    const msg = e.data;
    if (msg.type !== 'analyze') return;

    try {
        self.postMessage({
            type: 'progress',
            payload: { stage: 'Initializing Essentia...', percent: 10 }
        });

        if (!self.EssentiaWASM) {
            self.importScripts('/wasm/essentia-wasm.umd.js');
            self.importScripts('/wasm/essentia.js-core.umd.js');
        }

        self.postMessage({
            type: 'progress',
            payload: { stage: 'Analyzing audio...', percent: 40 }
        });

        let wasmModule = self.EssentiaWASM;
        if (typeof self.EssentiaWASM === 'function') {
            wasmModule = await self.EssentiaWASM();
            self.EssentiaWASM = wasmModule; // Cache the resolved module
        }

        const essentia = new self.Essentia(wasmModule);
        const audioData = msg.audioData;
        const audioVector = essentia.arrayToVector(audioData);

        self.postMessage({
            type: 'progress',
            payload: { stage: 'Extracting rhythm...', percent: 60 }
        });

        const result = essentia.RhythmExtractor2013(
            audioVector,
            208, // maxTempo
            40,  // minTempo
        );

        const bpm = result.bpm;
        const beats = essentia.vectorToArray(result.ticks);
        const confidence = result.confidence;

        self.postMessage({
            type: 'progress',
            payload: { stage: 'Finalizing...', percent: 100 }
        });

        self.postMessage({
            type: 'result',
            payload: {
                bpm,
                beats: Array.from(beats),
                confidence
            }
        });

        audioVector.delete();
    } catch (error) {
        self.postMessage({
            type: 'error',
            message: error.message || 'Essentia worker failed'
        });
    }
};
