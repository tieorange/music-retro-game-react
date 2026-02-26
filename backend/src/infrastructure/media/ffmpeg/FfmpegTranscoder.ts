import { ITranscoderPort } from '../../../application/ports/IMediaPorts';
import { spawn } from 'child_process';

export class FfmpegTranscoder implements ITranscoderPort {
    async transcodeToMp3(inputPath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // standard mp3 parameters for gameplay
            const args = [
                '-i', inputPath,
                '-codec:a', 'libmp3lame',
                '-b:a', '192k',
                '-ar', '44100',
                '-ac', '2',
                '-y', // Overwrite output
                outputPath
            ];

            const ffmpegPath = '/usr/local/bin/ffmpeg';
            const process = spawn(ffmpegPath, args);
            let stderr = '';

            process.stderr.on('data', (data) => stderr += data);

            process.on('error', (err) => {
                console.error('[DEBUG] ffmpeg spawn error:', err);
                reject(new Error(`Failed to start ffmpeg: ${err.message}`));
            });

            process.on('close', (code) => {
                if (code !== 0) return reject(new Error(`ffmpeg transcode failed: ${stderr}`));
                resolve();
            });
        });
    }
}
