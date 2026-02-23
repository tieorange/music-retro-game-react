import { describe, it, expect } from 'vitest';
import { decodeAudioFile } from './audioDecoder';

// @ts-ignore
import queenMp3Url from '../../../Queen - We Will Rock You.mp3?url';

describe('audioDecoder', () => {
    it('should successfully decode a real MP3 file into an AudioBuffer', async () => {
        // Fetch the file to get a Blob, then create a File object
        const response = await fetch(queenMp3Url);
        const blob = await response.blob();
        const file = new File([blob], 'Queen - We Will Rock You.mp3', { type: 'audio/mpeg' });

        const audioBuffer = await decodeAudioFile(file);

        expect(audioBuffer).toBeDefined();
        // Browser AudioContext decodes typical MP3s
        expect(audioBuffer.sampleRate).toBeGreaterThan(0);
        expect(audioBuffer.duration).toBeGreaterThan(0);
        expect(audioBuffer.numberOfChannels).toBeGreaterThanOrEqual(1);
    });

    it('should reject when given an invalid file', async () => {
        // Form a text file that should fail decodeAudioData
        const file = new File(['not an audio file content just some text'], 'dummy.txt', { type: 'text/plain' });

        // Depending on browser implementation, it either throws or rejects
        await expect(decodeAudioFile(file)).rejects.toThrow();
    });
});
