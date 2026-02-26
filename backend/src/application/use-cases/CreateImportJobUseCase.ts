import { ImportJob, ImportStatus } from '../../domain/entities/ImportJob';
import { IImportJobRepository, IJobQueuePort } from '../ports/IDataPorts';

export interface CreateImportJobDTO {
    youtubeUrl: string;
    licenseConfirmed: boolean;
    licenseNote?: string;
}

export class CreateImportJobUseCase {
    constructor(
        private jobRepo: IImportJobRepository,
        private queuePort: IJobQueuePort
    ) { }

    async execute(dto: CreateImportJobDTO): Promise<{ jobId: string }> {
        if (!dto.licenseConfirmed) {
            throw new Error('License confirmation is required');
        }

        const jobId = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const job = new ImportJob({
            id: jobId,
            youtubeUrl: dto.youtubeUrl,
            status: ImportStatus.QUEUED,
            progress: 0,
            licenseConfirmed: dto.licenseConfirmed,
            licenseNote: dto.licenseNote,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        await this.jobRepo.save(job);
        await this.queuePort.enqueueImport(jobId);

        return { jobId };
    }
}
