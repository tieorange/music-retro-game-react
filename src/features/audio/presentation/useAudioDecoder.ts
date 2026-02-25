import { useState } from 'react';
import { logInfo, logError } from '@/core/logging';
import { decodeAudioFile } from '@/features/audio/data/audioDecoder';

interface UseAudioDecoderResult {
    isDecoding: boolean;
    error: string | null;
    decode: (file: File) => Promise<AudioBuffer | null>;
}

export function useAudioDecoder(): UseAudioDecoderResult {
    const [isDecoding, setIsDecoding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const decode = async (file: File) => {
        setIsDecoding(true);
        setError(null);

        try {
            logInfo('audio.decode.started', {
                fileName: file.name.slice(-40),
                fileSize: file.size,
                fileType: file.type,
            });
            const t0 = performance.now();
            const audioBuffer = await decodeAudioFile(file);
            const durationMs = Math.round(performance.now() - t0);
            setIsDecoding(false);
            logInfo('audio.decode.succeeded', {
                duration: audioBuffer.duration,
                sampleRate: audioBuffer.sampleRate,
                numberOfChannels: audioBuffer.numberOfChannels,
                durationMs,
            });
            logInfo('perf.decode.duration', { ms: durationMs });
            return audioBuffer;
        } catch (err: any) {
            logError('audio.decode.failed', { fileName: file.name.slice(-40) }, err);
            setError(err.message || 'Failed to decode audio');
            setIsDecoding(false);
            return null;
        }
    };

    return { isDecoding, error, decode };
}
