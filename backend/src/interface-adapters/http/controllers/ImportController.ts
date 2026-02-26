import { Request, Response } from 'express';
import { CreateImportJobUseCase } from '../../../application/use-cases/CreateImportJobUseCase.js';
import { GetImportJobStatusUseCase } from '../../../application/use-cases/GetImportJobStatusUseCase.js';

export class ImportController {
    constructor(
        private createJobUseCase: CreateImportJobUseCase,
        private getStatusUseCase: GetImportJobStatusUseCase
    ) { }

    async create(req: Request, res: Response) {
        try {
            const { youtubeUrl, licenseConfirmed, licenseNote } = req.body;
            const result = await this.createJobUseCase.execute({
                youtubeUrl,
                licenseConfirmed,
                licenseNote,
            });
            res.status(201).json(result);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }

    async getStatus(req: Request, res: Response) {
        try {
            const { jobId } = req.params;
            const result = await this.getStatusUseCase.execute(jobId);
            res.json(result);
        } catch (error: any) {
            const statusCode = error.message === 'Job not found' ? 404 : 500;
            res.status(statusCode).json({ message: error.message });
        }
    }
}
