import { ImportJob } from '../domain/entities/ImportJob.js';
import { Track } from '../domain/entities/Track.js';

export interface IImportJobRepository {
    save(job: ImportJob): Promise<void>;
    findById(id: string): Promise<ImportJob | null>;
}

export interface ITrackRepository {
    save(track: Track): Promise<void>;
    findById(id: string): Promise<Track | null>;
}

export interface IObjectStoragePort {
    uploadFile(localPath: string, destinationKey: string): Promise<string>; // Returns CDN URL or storage path
    getSignedUrl(key: string): Promise<string>;
}

export interface IJobQueuePort {
    enqueueImport(jobId: string): Promise<void>;
}
