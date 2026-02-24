export type AudioErrorCode = 'FILE_EMPTY' | 'FILE_TOO_LARGE' | 'FORMAT_UNSUPPORTED' | 'DECODE_FAILED';

export class AudioValidationError extends Error {
    constructor(public readonly code: AudioErrorCode, message?: string) {
        super(message ?? code);
        this.name = 'AudioValidationError';
    }
}
