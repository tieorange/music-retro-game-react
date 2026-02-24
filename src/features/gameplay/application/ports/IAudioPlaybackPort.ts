export interface IAudioPlaybackPort {
    start(): Promise<void>;
    warmUp(): Promise<void>;
    pause(): void;
    resume(): void;
    stop(): void;
    destroy(): void;
    load(buffer: AudioBuffer): Promise<void>;
    seek(timeSeconds: number): void;
    readonly duration: number;
    readonly isPlaying: boolean;
    readonly currentTime: number;
}
