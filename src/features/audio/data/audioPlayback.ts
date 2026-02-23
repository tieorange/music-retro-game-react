import * as Tone from 'tone';

export class AudioPlaybackService {
    private player: Tone.Player | null = null;
    private analyser: Tone.Analyser | null = null;

    public async load(audioBuffer: AudioBuffer): Promise<void> {
        // Create Tone.js AudioBuffer from standard AudioBuffer
        const toneBuffer = new Tone.ToneAudioBuffer(audioBuffer);

        this.player = new Tone.Player(toneBuffer).toDestination();
        this.player.sync().start(0);

        // Create FFT analyser for visualizer
        this.analyser = new Tone.Analyser('fft', 32);
        this.player.connect(this.analyser);
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

    public getAnalyser(): Tone.Analyser | null {
        return this.analyser;
    }

    public destroy(): void {
        this.stop();
        if (this.player) {
            this.player.dispose();
            this.player = null;
        }
        if (this.analyser) {
            this.analyser.dispose();
            this.analyser = null;
        }
    }
}
