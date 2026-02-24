import * as Tone from 'tone';
import { IAudioMixerPort } from '../application/ports/IAudioMixerPort';

export class AudioMixer implements IAudioMixerPort {
    private musicBus: Tone.Volume;
    private sfxBus: Tone.Volume;
    private masterBus: Tone.Volume;
    private masterLimiter: Tone.Limiter;

    constructor() {
        this.masterLimiter = new Tone.Limiter(-0.5).toDestination();
        this.masterBus = new Tone.Volume(0).connect(this.masterLimiter);
        this.musicBus = new Tone.Volume(-6).connect(this.masterBus);
        this.sfxBus = new Tone.Volume(-8).connect(this.masterBus);
    }

    get musicOutput(): Tone.Volume { return this.musicBus; }
    get sfxOutput(): Tone.Volume { return this.sfxBus; }

    setMusicVolume(db: number): void { this.musicBus.volume.value = db; }
    setSfxVolume(db: number): void { this.sfxBus.volume.value = db; }
    setMasterVolume(db: number): void { this.masterBus.volume.value = db; }

    destroy(): void {
        this.musicBus.dispose();
        this.sfxBus.dispose();
        this.masterBus.dispose();
        this.masterLimiter.dispose();
    }
}
