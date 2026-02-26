import { IYoutubeDownloaderPort, VideoMetadata } from '../../../application/ports/IMediaPorts';
import { spawn } from 'child_process';

export class YtDlpDownloader implements IYoutubeDownloaderPort {
    async getMetadata(url: string): Promise<VideoMetadata> {
        const ytDlpPath = '/usr/local/bin/yt-dlp';
        console.log(`[DEBUG] yt-dlp getMetadata starting for: ${url} using ${ytDlpPath}`);
        return new Promise((resolve, reject) => {
            const process = spawn(ytDlpPath, ['--dump-json', '--no-playlist', url]);
            let stdout = '';
            let stderr = '';

            const timeout = setTimeout(() => {
                process.kill();
                reject(new Error('yt-dlp metadata timeout after 30s'));
            }, 30000);

            process.stdout.on('data', (data) => stdout += data);
            process.stderr.on('data', (data) => stderr += data);

            process.on('error', (err) => {
                clearTimeout(timeout);
                console.error('[DEBUG] yt-dlp spawn error (metadata):', err);
                reject(new Error(`Failed to start yt-dlp: ${err.message}`));
            });

            process.on('close', (code) => {
                clearTimeout(timeout);
                console.log(`[DEBUG] yt-dlp metadata closed with code ${code}`);
                if (code !== 0) {
                    console.error(`[DEBUG] yt-dlp metadata stderr: ${stderr}`);
                    return reject(new Error(`yt-dlp metadata failed: ${stderr}`));
                }
                try {
                    const json = JSON.parse(stdout);
                    resolve({
                        videoId: json.id,
                        title: json.title,
                        durationSec: json.duration,
                    });
                } catch (e) {
                    console.error('[DEBUG] Failed to parse yt-dlp stdout:', stdout.slice(0, 200));
                    reject(new Error('Failed to parse yt-dlp output'));
                }
            });
        });
    }

    async downloadAudio(url: string, outputPath: string, onProgress?: (percent: number) => void): Promise<void> {
        const ytDlpPath = '/usr/local/bin/yt-dlp';
        return new Promise((resolve, reject) => {
            // yt-dlp -o 'path' adds the extension automatically if --extract-audio is used
            const args = [
                '-f', 'bestaudio',
                '--extract-audio',
                '--audio-format', 'wav',
                '--no-playlist',
                '--force-overwrites',
                '-o', outputPath.replace(/\.wav$/, ''), // yt-dlp will add .wav
                url
            ];

            const process = spawn(ytDlpPath, args);

            process.on('error', (err) => {
                console.error('[DEBUG] yt-dlp spawn error (download):', err);
                reject(new Error(`Failed to start yt-dlp: ${err.message}`));
            });

            process.on('close', async (code) => {
                if (code !== 0) return reject(new Error(`yt-dlp download failed with code ${code}`));
                resolve();
            });

            process.stdout.on('data', (data) => {
                const line = data.toString();
                const match = line.match(/\[download\]\s+(\d+\.\d+)%/);
                if (match && onProgress) {
                    onProgress(parseFloat(match[1]));
                }
            });
        });
    }
}
