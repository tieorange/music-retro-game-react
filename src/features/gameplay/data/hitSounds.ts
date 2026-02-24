import * as Tone from 'tone';
import { HitJudgment } from '@/features/gameplay/domain/types';;

export class HitSoundService {
    private perfectSynth!: Tone.Synth;
    private greatSynth!: Tone.Synth;
    private goodSynth!: Tone.Synth;
    private missSynth!: Tone.MembraneSynth;

    private milestoneSynth!: Tone.PolySynth;
    private breakSynth!: Tone.Synth;

    private volumeNode!: Tone.Volume;
    private isInitialized = false;

    public async init() {
        if (this.isInitialized) return;

        try {
            if (Tone.context.state !== 'running') {
                await Tone.start();
            }
        } catch (error) {
            console.warn("Could not start Tone.js audio context automatically.", error);
        }

        // Master volume for hit sounds (mixed lower than music)
        this.volumeNode = new Tone.Volume(-8).toDestination();

        // PERFECT: High metallic TING
        this.perfectSynth = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }
        }).connect(this.volumeNode);

        // GREAT: Mid-frequency CLICK
        this.greatSynth = new Tone.Synth({
            oscillator: { type: 'square' },
            envelope: { attack: 0.01, decay: 0.05, sustain: 0, release: 0.05 }
        }).connect(this.volumeNode);

        // GOOD: Softer TICK
        this.goodSynth = new Tone.Synth({
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.01, decay: 0.05, sustain: 0, release: 0.05 }
        }).connect(this.volumeNode);

        // MISS: Low THUD
        this.missSynth = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 2,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.2 }
        }).connect(this.volumeNode);

        // Milestones
        this.milestoneSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.05, decay: 0.2, sustain: 0.2, release: 1 }
        }).connect(this.volumeNode);

        // Combo Break
        this.breakSynth = new Tone.Synth({
            oscillator: { type: 'pwm', modulationFrequency: 0.2 },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0, release: 0.2 }
        }).connect(this.volumeNode);

        this.isInitialized = true;
    }

    public playHit(judgment: HitJudgment) {
        if (!this.isInitialized) return;

        const time = Tone.now();
        switch (judgment) {
            case 'perfect':
                this.perfectSynth.triggerAttackRelease('C6', '16n', time);
                break;
            case 'great':
                this.greatSynth.triggerAttackRelease('G5', '32n', time);
                break;
            case 'good':
                this.goodSynth.triggerAttackRelease('E5', '32n', time, 0.5);
                break;
            case 'miss':
                this.missSynth.triggerAttackRelease('C2', '8n', time);
                break;
        }
    }

    public playMilestone(combo: number) {
        if (!this.isInitialized) return;

        const time = Tone.now();
        if (combo === 10) {
            // Ascending chime
            this.perfectSynth.triggerAttackRelease('C5', '32n', time);
            this.perfectSynth.triggerAttackRelease('E5', '32n', time + 0.1);
            this.perfectSynth.triggerAttackRelease('G5', '16n', time + 0.2);
        } else if (combo === 30) {
            // Synth chord
            this.milestoneSynth.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], '8n', time);
        } else if (combo === 50) {
            // Bigger chord
            this.milestoneSynth.triggerAttackRelease(['C3', 'G3', 'C4', 'E4', 'G4'], '4n', time);
        } else if (combo >= 100 && combo % 50 === 0) {
            this.milestoneSynth.triggerAttackRelease(['C3', 'G3', 'C4', 'E4', 'G4', 'C5'], '2n', time);
        }
    }

    public playComboBreak() {
        if (!this.isInitialized) return;
        const time = Tone.now();
        this.breakSynth.triggerAttackRelease('G2', '8n', time);
        this.breakSynth.triggerAttackRelease('C2', '4n', time + 0.15);
    }

    public destroy() {
        if (!this.isInitialized) return;
        this.perfectSynth.dispose();
        this.greatSynth.dispose();
        this.goodSynth.dispose();
        this.missSynth.dispose();
        this.milestoneSynth.dispose();
        this.breakSynth.dispose();
        this.volumeNode.dispose();
        this.isInitialized = false;
    }
}
