import { useState } from 'react';
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
            const audioBuffer = await decodeAudioFile(file);
            setIsDecoding(false);
            return audioBuffer;
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to decode audio');
            setIsDecoding(false);
            return null;
        }
    };

    return { isDecoding, error, decode };
}
