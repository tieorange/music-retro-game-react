import { YtDlpDownloader } from '../src/infrastructure/media/ytdlp/YtDlpDownloader.js';
import { FfmpegTranscoder } from '../src/infrastructure/media/ffmpeg/FfmpegTranscoder.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import { tmpdir } from 'os';

async function verify() {
    const url = process.argv[2];
    if (!url) {
        console.error('Please provide a YouTube URL: npx ts-node scripts/verify-pipeline.ts <url>');
        process.exit(1);
    }

    const downloader = new YtDlpDownloader();
    const transcoder = new FfmpegTranscoder();

    const workDir = path.join(tmpdir(), 'pixelbeat_verify');
    const rawPath = path.join(workDir, 'raw.wav');
    const mp3Path = path.join(workDir, 'output.mp3');

    try {
        await fs.mkdir(workDir, { recursive: true });

        console.log('--- Step 1: Metadata ---');
        const meta = await downloader.getMetadata(url);
        console.log('Title:', meta.title);
        console.log('Duration:', meta.durationSec, 's');

        console.log('\n--- Step 2: Download (yt-dlp) ---');
        await downloader.downloadAudio(url, rawPath, (p) => {
            process.stdout.write(`\rProgress: ${p}%`);
        });
        console.log('\nDownload complete.');

        console.log('\n--- Step 3: Transcode (ffmpeg) ---');
        await transcoder.transcodeToMp3(rawPath, mp3Path);
        console.log('Transcode complete: ', mp3Path);

        const stats = await fs.stat(mp3Path);
        console.log(`Final MP3 size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        console.log('\nSUCCESS: Pipeline is working correctly.');
    } catch (err) {
        console.error('\nFAILED:', err);
    } finally {
        // Keep files for manual inspection if needed, or cleanup
        console.log('\nTemp files located at:', workDir);
    }
}

verify();
