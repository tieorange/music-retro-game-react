import * as Tone from 'tone';

export interface IAudioMixerPort {
    readonly musicOutput: Tone.Volume;
    readonly sfxOutput: Tone.Volume;
    setMusicVolume(db: number): void;
    setSfxVolume(db: number): void;
    setMasterVolume(db: number): void;
    destroy(): void;
}
