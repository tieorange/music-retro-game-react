import { IImportJobRepository, ITrackRepository } from '../ports/IDataPorts';

export class GetImportJobStatusUseCase {
    constructor(
        private jobRepo: IImportJobRepository,
        private trackRepo: ITrackRepository
    ) { }

    async execute(jobId: string) {
        const job = await this.jobRepo.findById(jobId);
        if (!job) throw new Error('Job not found');

        const result: any = {
            jobId: job.id,
            status: job.status,
            progress: job.progress,
        };

        if (job.trackId) {
            const track = await this.trackRepo.findById(job.trackId);
            if (track) {
                result.track = {
                    trackId: track.id,
                    title: track.title,
                    audioUrl: track.cdnUrl,
                };
            }
        }

        return result;
    }
}
