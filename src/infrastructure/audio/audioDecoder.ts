export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
    const fileReader = new FileReader();

    return new Promise((resolve, reject) => {
        fileReader.onload = async (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            if (!arrayBuffer) {
                reject(new Error("Failed to read file"));
                return;
            }

            try {
                // Create an AudioContext just for decoding, then close it
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                // Wait for state to be closed to free memory if possible, though GC will get it
                if (audioContext.state !== 'closed') {
                    audioContext.close().catch(console.error);
                }

                resolve(audioBuffer);
            } catch (err) {
                reject(new Error("Failed to decode audio data. Unsupported format?"));
            }
        };

        fileReader.onerror = () => {
            reject(new Error("File read error"));
        };

        fileReader.readAsArrayBuffer(file);
    });
}
