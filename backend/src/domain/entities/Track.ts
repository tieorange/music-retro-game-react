export interface TrackProps {
    id: string;
    source: 'youtube';
    sourceVideoId: string;
    title: string;
    durationSec: number;
    storageKey: string;
    cdnUrl: string;
    audioFormat: 'mp3';
    createdAt: Date;
}

export class Track {
    private props: TrackProps;

    constructor(props: TrackProps) {
        this.props = props;
    }

    public get id(): string { return this.props.id; }
    public get title(): string { return this.props.title; }
    public get cdnUrl(): string { return this.props.cdnUrl; }

    public toJSON() {
        return { ...this.props };
    }
}
