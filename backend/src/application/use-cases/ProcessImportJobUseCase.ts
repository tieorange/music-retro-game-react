import { ImportStatus } from '../../domain/entities/ImportJob';
import { Track } from '../../domain/entities/Track';
import { IImportJobRepository, ITrackRepository, IObjectStoragePort } from '../ports/IDataPorts';
import { IYoutubeDownloaderPort, ITranscoderPort } from '../ports/IMediaPorts';
import * as path from 'path';
import * as fs from 'fs/promises';
import { tmpdir } from 'os';

export class ProcessImportJobUseCase {
    constructor(
        private jobRepo: IImportJobRepository,
        private trackRepo: ITrackRepository,
        private downloader: IYoutubeDownloaderPort,
        private transcoder: ITranscoderPort,
        private storage: IObjectStoragePort
    ) { }

    async execute(jobId: string): Promise<void> {
        console.log(`[DEBUG] Starting execution for job: ${jobId}`);
        const job = await this.jobRepo.findById(jobId);
        if (!job) {
            console.error(`[DEBUG] Job ${jobId} not found in repository`);
            throw new Error(`Job ${jobId} not found`);
        }

        console.log(`[DEBUG] Found job for URL: ${job.youtubeUrl}`);
        const workDir = path.join(tmpdir(), `pixelbeat_${jobId}`);
        const rawPath = path.join(workDir, 'raw.wav');
        const mp3Path = path.join(workDir, 'output.mp3');

        try {
            console.log(`[DEBUG] Creating work directory: ${workDir}`);
            await fs.mkdir(workDir, { recursive: true });

            // 1. Get Metadata
            console.log(`[DEBUG] Fetching metadata for ${job.youtubeUrl}...`);
            job.updateStatus(ImportStatus.VALIDATING);
            await this.jobRepo.save(job);
            const metadata = await this.downloader.getMetadata(job.youtubeUrl);
            console.log(`[DEBUG] Metadata fetched: ${metadata.title}`);

            // 2. Download
            job.updateStatus(ImportStatus.DOWNLOADING, 10);
            await this.jobRepo.save(job);
            await this.downloader.downloadAudio(job.youtubeUrl, rawPath, (p) => {
                // Debounce actual DB updates if needed
                console.log(`Download progress: ${p}%`);
            });

            // 3. Transcode
            job.updateStatus(ImportStatus.TRANSCODING, 60);
            await this.jobRepo.save(job);
            await this.transcoder.transcodeToMp3(rawPath, mp3Path);

            // 4. Upload
            job.updateStatus(ImportStatus.UPLOADING, 80);
            await this.jobRepo.save(job);
            const trackId = `trk_${Date.now()}`;
            const storageKey = `tracks/${trackId}.mp3`;
            const cdnUrl = await this.storage.uploadFile(mp3Path, storageKey);

            // 5. Save Track and Complete Job
            const track = new Track({
                id: trackId,
                source: 'youtube',
                sourceVideoId: metadata.videoId,
                title: metadata.title,
                durationSec: metadata.durationSec,
                storageKey,
                cdnUrl,
                audioFormat: 'mp3',
                createdAt: new Date(),
            });

            await this.trackRepo.save(track);
            job.complete(trackId);
            await this.jobRepo.save(job);

        } catch (error: any) {
            console.error(`Job ${jobId} failed:`, error);
            job.fail('INTERNAL_ERROR', error.message || 'Unknown error');
            await this.jobRepo.save(job);
        } finally {
            // await fs.rm(workDir, { recursive: true, force: true }).catch(() => { });
        }
    }
}
