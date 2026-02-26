import { useState, useCallback } from 'react';
import { logInfo, logError } from '@/core/logging';
import { youtubeImportApi } from '../data/youtubeImportApi';

export const useYoutubeImport = () => {
    const [isImporting, setIsImporting] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const pollStatus = useCallback(async (jobId: string) => {
        const poll = async () => {
            try {
                const data = await youtubeImportApi.getJobStatus(jobId);
                setStatus(data.status);
                setProgress(data.progress);

                if (data.status === 'completed') {
                    logInfo('youtube.import.status_poll.completed', { jobId });
                    setIsImporting(false);
                    return data;
                } else if (data.status === 'failed') {
                    logError('youtube.import.status_poll.failed', { jobId, error: data.errorMessage });
                    setError(data.errorMessage || 'Import failed');
                    setIsImporting(false);
                    return null;
                } else {
                    logInfo('youtube.import.status_poll.running', { jobId, status: data.status, progress: data.progress });
                    // Continue polling
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return poll();
                }
            } catch (err) {
                setError('Connection error while polling');
                setIsImporting(false);
                return null;
            }
        };
        return poll();
    }, []);

    const startImport = async (url: string, licenseConfirmed: boolean) => {
        setIsImporting(true);
        setError(null);
        setStatus('Initiating...');
        setProgress(0);

        try {
            const { jobId } = await youtubeImportApi.createJob(url, licenseConfirmed);
            return await pollStatus(jobId);
        } catch (err: any) {
            setError(err.message || 'Failed to start import');
            setIsImporting(false);
            return null;
        }
    };

    return { startImport, isImporting, status, progress, error };
};
