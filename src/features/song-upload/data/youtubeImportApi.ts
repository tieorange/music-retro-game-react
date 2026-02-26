import { logInfo, logError } from '@/core/logging';

const API_BASE_URL = (import.meta as any).env?.VITE_IMPORT_API_BASE_URL || 'http://localhost:3000';

export const youtubeImportApi = {
    async createJob(youtubeUrl: string, licenseConfirmed: boolean) {
        logInfo('youtube.import.create_job.requested', { youtubeUrl });
        try {
            const response = await fetch(`${API_BASE_URL}/v1/imports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youtubeUrl, licenseConfirmed }),
            });

            if (!response.ok) {
                const error = await response.json();
                logError('youtube.import.create_job.failed', { status: response.status }, error);
                throw new Error(error.message || `Failed to create import job (${response.status})`);
            }

            const data = await response.json();
            logInfo('youtube.import.create_job.succeeded', { jobId: data.jobId });
            return data;
        } catch (err: any) {
            logError('youtube.import.create_job.network_error', { url: `${API_BASE_URL}/v1/imports` }, err);
            throw err;
        }
    },

    async getJobStatus(jobId: string) {
        try {
            const response = await fetch(`${API_BASE_URL}/v1/imports/${jobId}`);

            if (!response.ok) {
                logError('youtube.import.get_status.failed', { jobId, status: response.status });
                throw new Error(`Failed to fetch job status (${response.status})`);
            }

            return response.json();
        } catch (err: any) {
            logError('youtube.import.get_status.network_error', { jobId }, err);
            throw err;
        }
    }
};
