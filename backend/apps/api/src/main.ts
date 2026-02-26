import express, { Request, Response } from 'express';
import cors from 'cors';
import { ImportController } from '../../../src/interface-adapters/http/controllers/ImportController.js';
import { CreateImportJobUseCase } from '../../../src/application/use-cases/CreateImportJobUseCase.js';
import { GetImportJobStatusUseCase } from '../../../src/application/use-cases/GetImportJobStatusUseCase.js';
import { IImportJobRepository, ITrackRepository, IJobQueuePort, IObjectStoragePort } from '../../../src/application/ports/IDataPorts.js';
import { ImportJob } from '../../../src/domain/entities/ImportJob.js';
import { Track } from '../../../src/domain/entities/Track.js';
import { ProcessImportJobUseCase } from '../../../src/application/use-cases/ProcessImportJobUseCase.js';
import { YtDlpDownloader } from '../../../src/infrastructure/media/ytdlp/YtDlpDownloader.js';
import { FfmpegTranscoder } from '../../../src/infrastructure/media/ffmpeg/FfmpegTranscoder.js';

class InMemoryImportJobRepo implements IImportJobRepository {
    private jobs = new Map<string, ImportJob>();
    async save(job: ImportJob) { this.jobs.set(job.id, job); }
    async findById(id: string) { return this.jobs.get(id) || null; }
}

class InMemoryTrackRepo implements ITrackRepository {
    private tracks = new Map<string, Track>();
    async save(track: Track) { this.tracks.set(track.id, track); }
    async findById(id: string) { return this.tracks.get(id) || null; }
}

class MockQueuePort implements IJobQueuePort {
    constructor(private processUseCase?: ProcessImportJobUseCase) { }
    async enqueueImport(jobId: string) {
        console.log(`Enqueued job: ${jobId}`);
        if (this.processUseCase) {
            // Simulate async processing without blocking the API response
            this.processUseCase.execute(jobId).catch(err => console.error('Processing error:', err));
        }
    }
}

class MockStoragePort implements IObjectStoragePort {
    private uploadedFiles = new Map<string, string>(); // key -> localPath

    async uploadFile(localPath: string, key: string): Promise<string> {
        console.log(`Mock upload: ${localPath} -> ${key}`);
        this.uploadedFiles.set(key, localPath);
        return `http://localhost:3000/mock-cdn/${key}`;
    }
    async deleteFile(key: string): Promise<void> { }
    async getSignedUrl(key: string): Promise<string> {
        return `http://localhost:3000/mock-cdn/${key}`;
    }
    getLocalPath(key: string): string | undefined {
        return this.uploadedFiles.get(key);
    }
}

const app = express();
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

const jobRepo = new InMemoryImportJobRepo();
const trackRepo = new InMemoryTrackRepo();
const storagePort = new MockStoragePort();
const downloader = new YtDlpDownloader();
const transcoder = new FfmpegTranscoder();

const processUseCase = new ProcessImportJobUseCase(
    jobRepo,
    trackRepo,
    downloader,
    transcoder,
    storagePort
);

const queuePort = new MockQueuePort(processUseCase);

const createUseCase = new CreateImportJobUseCase(jobRepo, queuePort);
const statusUseCase = new GetImportJobStatusUseCase(jobRepo, trackRepo);
const controller = new ImportController(createUseCase, statusUseCase);

app.post('/v1/imports', (req: Request, res: Response) => controller.create(req, res));
app.get('/v1/imports/:jobId', (req: Request, res: Response) => controller.getStatus(req, res));

// Mock CDN endpoint to serve transcoded files
app.get('/mock-cdn/:prefix/:id', (req, res) => {
    const key = `${req.params.prefix}/${req.params.id}`;
    const localPath = storagePort.getLocalPath(key);
    if (localPath) {
        res.sendFile(localPath);
    } else {
        res.status(404).send('File not found in Mock CDN');
    }
});

app.get('/healthz', (req: Request, res: Response) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API Service listening on port ${PORT}`);
});
