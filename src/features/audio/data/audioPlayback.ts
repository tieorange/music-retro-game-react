import * as Tone from 'tone';
import { IAudioMixerPort } from '../application/ports/IAudioMixerPort';

export class AudioPlaybackService {
    private player: Tone.Player | null = null;
    private toneBuffer: Tone.ToneAudioBuffer | null = null;
    private isDestroyed = false;

    constructor(private mixer: IAudioMixerPort) { }

    public async load(audioBuffer: AudioBuffer): Promise<void> {
        // Create Tone.js AudioBuffer from standard AudioBuffer
        this.toneBuffer = new Tone.ToneAudioBuffer(audioBuffer);

        if (this.isDestroyed) {
            this.toneBuffer.dispose();
            return;
        }

        this.player = new Tone.Player(this.toneBuffer);
        this.player.fadeIn = 0.05;   // 50ms fade-in — imperceptible but eliminates click
        this.player.fadeOut = 0.3;    // 300ms fade-out — smooth ending
        this.player.connect(this.mixer.musicOutput);
        this.player.sync().start(0);
    }

    public async warmUp(): Promise<void> {
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
    }

    public async start(): Promise<void> {
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        Tone.getTransport().start();
    }

    public pause(): void {
        Tone.getTransport().pause();
    }

    public resume(): void {
        Tone.getTransport().start();
    }

    public stop(): void {
        Tone.getTransport().stop();
        // Also stop the player explicitly just in case
        if (this.player) {
            try {
                this.player.stop();
            } catch (error) {
                console.warn('[AudioPlaybackService] Ignored error during player stop:', error);
            }
        }
    }

    public get currentTime(): number {
        return Tone.getTransport().seconds;
    }

    public get duration(): number {
        return this.toneBuffer ? this.toneBuffer.duration : 0;
    }

    public get isPlaying(): boolean {
        return Tone.getTransport().state === 'started';
    }

    public seek(timeSeconds: number): void {
        Tone.getTransport().seconds = Math.max(0, Math.min(timeSeconds, this.duration));
    }

    public destroy(): void {
        this.isDestroyed = true;
        this.stop();
        if (this.player) {
            this.player.dispose();
            this.player = null;
        }
        if (this.toneBuffer) {
            this.toneBuffer.dispose();
            this.toneBuffer = null;
        }
    }
}
