import * as Tone from 'tone';
import { IAudioMixerPort } from '../application/ports/IAudioMixerPort';

export class AudioPlaybackService {
    private player: Tone.Player | null = null;
    private isDestroyed = false;

    constructor(private mixer: IAudioMixerPort) { }

    public async load(audioBuffer: AudioBuffer): Promise<void> {
        // Create Tone.js AudioBuffer from standard AudioBuffer
        const toneBuffer = new Tone.ToneAudioBuffer(audioBuffer);

        if (this.isDestroyed) {
            toneBuffer.dispose();
            return;
        }

        this.player = new Tone.Player(toneBuffer);
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
            this.player.stop();
        }
    }

    public get currentTime(): number {
        return Tone.getTransport().seconds;
    }

    public destroy(): void {
        this.isDestroyed = true;
        this.stop();
        Tone.getTransport().cancel();
        Tone.getTransport().position = 0;
        if (this.player) {
            this.player.dispose();
            this.player = null;
        }
    }
}
