export interface IAudioPlaybackPort {
    start(): Promise<void>;
    pause(): void;
    resume(): void;
    stop(): void;
    destroy(): void;
    load(buffer: AudioBuffer): Promise<void>;
}
