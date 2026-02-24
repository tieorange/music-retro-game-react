import { BeatMap } from '@/features/analysis/domain/types';
import { Lane } from '@/features/gameplay/domain/types';
import { IAudioPlaybackPort } from './ports/IAudioPlaybackPort';
import { IGameStatePort } from './ports/IGameStatePort';
import { NoteScheduler } from '../data/NoteScheduler';
import { NoteTracker } from '../domain/NoteTracker';
import { ScoringEngine } from '@/features/scoring/domain/ScoringEngine';
import { ComboTracker } from '@/features/scoring/domain/ComboTracker';
import { GameEventBus } from '../domain/GameEventBus';
import { COMBO_THRESHOLDS, NEAR_MISS_WINDOW } from '@/features/gameplay/domain/constants';

export class GameEngine {
    private playback: IAudioPlaybackPort;
    private state: IGameStatePort;
    private scheduler: NoteScheduler;
    private tracker: NoteTracker;
    private scoring: ScoringEngine;
    private combo: ComboTracker;
    private beatMap: BeatMap;
    private _isRunning: boolean = false;
    public events: GameEventBus;

    public get isRunning(): boolean {
        return this._isRunning;
    }

    constructor(beatMap: BeatMap, playback: IAudioPlaybackPort, state: IGameStatePort) {
        this.playback = playback;
        this.state = state;
        this.beatMap = beatMap;

        this.scheduler = new NoteScheduler();
        this.tracker = new NoteTracker(beatMap.notes, this.handleAutoMiss.bind(this));
        this.scoring = new ScoringEngine();
        this.combo = new ComboTracker();
        this.events = new GameEventBus();
    }

    public async start(): Promise<void> {
        this.scheduler.scheduleAll(this.beatMap.notes, (note) => {
            this.tracker.spawnNote(note);
        });

        await this.playback.start();
        this._isRunning = true;
    }

    public update(currentTime: number): void {
        if (!this._isRunning) return;

        this.tracker.update(currentTime);
        this.state.setCurrentTime(currentTime);

        const song = this.state.song;
        if (song && currentTime >= song.duration + 2.0) {
            this.endGame();
        }
    }

    public handleInput(lane: Lane, time: number): void {
        if (!this._isRunning) return;

        const result = this.tracker.judgeHit(lane, time);
        if (result) {
            this.combo.hit(result.judgment);
            result.comboAtHit = this.combo.combo;

            this.events.emit('hit', {
                judgment: result.judgment,
                lane,
                combo: this.combo.combo,
                multiplier: this.combo.multiplier
            });

            const isMilestone = COMBO_THRESHOLDS.some(t => t.combo === this.combo.combo) || (this.combo.combo >= 50 && this.combo.combo % 50 === 0);
            if (isMilestone && this.combo.combo >= 10) {
                this.events.emit('combo-milestone', { combo: this.combo.combo });
            }

            const addedScore = this.scoring.calculateScore(result.judgment, this.combo.multiplier);

            this.state.updateScoreAndCombo(
                this.state.score + addedScore,
                this.combo.combo,
                this.combo.multiplier
            );

            this.state.addHitResult(result);
        } else {
            const nearestDelta = this.tracker.getNearestNoteDelta(lane, time);
            if (nearestDelta !== null && Math.abs(nearestDelta) <= NEAR_MISS_WINDOW) {
                this.events.emit('near-miss', { lane });
            } else {
                this.events.emit('ghost-press', { lane });
            }
        }
    }

    private handleAutoMiss(noteId: string, lane: Lane): void {
        const previousCombo = this.combo.combo;
        this.combo.hit('miss');

        if (previousCombo > 0) {
            this.events.emit('combo-break', { previousCombo });
        }
        this.events.emit('miss', { lane });

        this.state.updateScoreAndCombo(this.state.score, 0, 1);
        this.state.addHitResult({
            noteId,
            judgment: 'miss',
            delta: 0,
            comboAtHit: 0
        });
    }

    public pause(): void {
        this._isRunning = false;
        this.playback.pause();
    }

    public resume(): void {
        this._isRunning = true;
        this.playback.resume();
    }

    public endGame(): void {
        this._isRunning = false;
        this.playback.stop();
        this.scheduler.clear();

        const song = this.state.song;
        if (!song) return;

        const finalScore = this.scoring.calculateFinalScore(
            song.id,
            song.name,
            this.beatMap.notes.length,
            this.state.hitResults,
            this.combo.maxCombo,
            this.state.score
        );

        this.state.setFinalScore(finalScore);
        this.state.setPhase('results');
    }

    public destroy(): void {
        this._isRunning = false;
        this.scheduler.clear();
        this.playback.destroy();
    }

    public getActiveNotes() {
        return this.tracker.getActiveNotes();
    }
}
