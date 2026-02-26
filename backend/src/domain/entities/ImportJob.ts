export enum ImportStatus {
    QUEUED = 'queued',
    VALIDATING = 'validating',
    DOWNLOADING = 'downloading',
    TRANSCODING = 'transcoding',
    UPLOADING = 'uploading',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELED = 'canceled',
}

export interface ImportJobProps {
    id: string;
    youtubeUrl: string;
    status: ImportStatus;
    progress: number;
    licenseConfirmed: boolean;
    licenseNote?: string;
    trackId?: string;
    errorCode?: string;
    errorMessage?: string;
    createdAt: Date;
    updatedAt: Date;
}

export class ImportJob {
    private props: ImportJobProps;

    constructor(props: ImportJobProps) {
        this.props = props;
    }

    public get id(): string { return this.props.id; }
    public get youtubeUrl(): string { return this.props.youtubeUrl; }
    public get status(): ImportStatus { return this.props.status; }
    public get progress(): number { return this.props.progress; }
    public get trackId(): string | undefined { return this.props.trackId; }

    public updateStatus(status: ImportStatus, progress?: number): void {
        const terminalStates = [ImportStatus.COMPLETED, ImportStatus.FAILED, ImportStatus.CANCELED];
        if (terminalStates.includes(this.props.status)) {
            throw new Error(`Cannot transition from terminal state ${this.props.status}`);
        }
        this.props.status = status;
        if (progress !== undefined) {
            this.props.progress = progress;
        }
        this.props.updatedAt = new Date();
    }

    public complete(trackId: string): void {
        this.props.trackId = trackId;
        this.updateStatus(ImportStatus.COMPLETED, 100);
    }

    public fail(code: string, message: string): void {
        this.props.errorCode = code;
        this.props.errorMessage = message;
        this.updateStatus(ImportStatus.FAILED);
    }

    public toJSON() {
        return { ...this.props };
    }
}
