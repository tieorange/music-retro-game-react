import { MAX_AUDIO_FILE_SIZE, SUPPORTED_AUDIO_MIME_TYPES, SUPPORTED_AUDIO_EXTENSIONS } from '../domain/constants';
import { AudioValidationError } from '../domain/errors';

export function validateAudioFile(file: File): void {
    if (file.size === 0) throw new AudioValidationError('FILE_EMPTY', 'File is empty');
    if (file.size > MAX_AUDIO_FILE_SIZE)
        throw new AudioValidationError('FILE_TOO_LARGE', `File exceeds ${MAX_AUDIO_FILE_SIZE / 1024 / 1024} MB limit`);

    const hasValidType = SUPPORTED_AUDIO_MIME_TYPES.includes(file.type);
    const hasValidExt = SUPPORTED_AUDIO_EXTENSIONS.some(ext =>
        file.name.toLowerCase().endsWith(ext)
    );
    if (!hasValidType && !hasValidExt)
        throw new AudioValidationError('FORMAT_UNSUPPORTED', 'Unsupported audio format');
}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
    validateAudioFile(file);
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

                try {
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    resolve(audioBuffer);
                } finally {
                    // Wait for state to be closed to free memory if possible, though GC will get it
                    if (audioContext.state !== 'closed') {
                        audioContext.close().catch(console.error);
                    }
                }
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
