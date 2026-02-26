export interface VideoMetadata {
    videoId: string;
    title: string;
    durationSec: number;
}

export interface IYoutubeDownloaderPort {
    getMetadata(url: string): Promise<VideoMetadata>;
    downloadAudio(url: string, outputPath: string, onProgress?: (percent: number) => void): Promise<void>;
}

export interface ITranscoderPort {
    transcodeToMp3(inputPath: string, outputPath: string): Promise<void>;
}
