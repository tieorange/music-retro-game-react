import { BeatMap } from '@/features/analysis/domain/types';
import { Lane, HitResult } from '@/features/gameplay/domain/types';
import { IAudioPlaybackPort } from './ports/IAudioPlaybackPort';
import { IGameStatePort } from './ports/IGameStatePort';
import { INoteSchedulerPort } from './ports/INoteSchedulerPort';
import { IHitSoundPort } from './ports/IHitSoundPort';
import { ITimeProvider } from './ports/ITimeProvider';
import { ScoringEngine } from '@/features/scoring/domain/ScoringEngine';
import { ComboTracker } from '../domain/ComboTracker';
import { GameEventBus } from '../domain/GameEventBus';
import { NoteTracker } from '../domain/NoteTracker';
import { NEAR_MISS_WINDOW } from '@/features/gameplay/domain/constants';
import { logInfo, setGameSnapshot } from '@/core/logging';

export class GameEngine {
    private playback: IAudioPlaybackPort;
    private state: IGameStatePort;
    private scheduler: INoteSchedulerPort;
    private tracker: NoteTracker;
    public hitSounds: IHitSoundPort;
    public timeProvider: ITimeProvider;
    private scoring: ScoringEngine;
    private combo: ComboTracker;
    private _score: number = 0;
    private hitResults: HitResult[] = [];
    public beatMap: BeatMap;
    private _isRunning: boolean = false;
    private _hasStarted: boolean = false;
    private _lastScoreLogTime: number = 0;
    public events: GameEventBus;

    public get isRunning(): boolean {
        return this._isRunning;
    }

    public get score(): number { return this._score; }
    public get currentCombo(): number { return this.combo.combo; }
    public get currentMultiplier(): number { return this.combo.multiplier; }
    public get currentTime(): number { return this.timeProvider.getCurrentTime(); }

    constructor(
        beatMap: BeatMap,
        playback: IAudioPlaybackPort,
        state: IGameStatePort,
        scheduler: INoteSchedulerPort,
        hitSounds: IHitSoundPort,
        timeProvider: ITimeProvider,
        tracker: NoteTracker
    ) {
        this.playback = playback;
        this.state = state;
        this.beatMap = beatMap;
        this.scheduler = scheduler;
        this.hitSounds = hitSounds;
        this.timeProvider = timeProvider;
        this.tracker = tracker;

        this.tracker.setOnMiss(this.handleAutoMiss.bind(this));

        this.scoring = new ScoringEngine();
        this.combo = new ComboTracker();
        this.events = new GameEventBus();
    }

    public async start(): Promise<void> {
        if (this._hasStarted) {
            this.resume();
            return;
        }

        this.scheduler.scheduleAll(this.beatMap.notes, (note) => {
            this.tracker.spawnNote(note);
        });

        await this.playback.start();
        this._isRunning = true;
        this._hasStarted = true;
        logInfo('game.start', { noteCount: this.beatMap.notes.length, bpm: this.beatMap.bpm });
        setGameSnapshot({ phase: 'playing' });
    }

    public update(currentTime: number): void {
        if (!this._isRunning) return;

        const { holdTicks } = this.tracker.update(currentTime);
        this.state.setCurrentTime(currentTime);

        const now = performance.now();
        if (now - this._lastScoreLogTime > 250) {
            logInfo('game.score.updated', {
                score: this._score,
                combo: this.combo.combo,
                multiplier: this.combo.multiplier,
            });
            setGameSnapshot({ score: this._score, maxCombo: this.combo.maxCombo, phase: 'playing' });
            this._lastScoreLogTime = now;
        }

        if (holdTicks > 0) {
            this._score += holdTicks * 10 * this.combo.multiplier;
            this.state.updateScoreAndCombo(this._score, this.combo.combo, this.combo.multiplier);
        }

        const song = this.state.song;
        if (song && currentTime >= song.duration + 0.5) {
            this.endGame();
        }
    }

    public handleInput(lane: Lane, time: number): void {
        if (!this._isRunning) return;

        const result = this.tracker.judgeHit(lane, time);
        if (result) {
            const comboResult = this.combo.hit(result.judgment);
            result.comboAtHit = comboResult.combo;

            this.events.emit('hit', {
                judgment: result.judgment,
                lane,
                combo: comboResult.combo,
                multiplier: comboResult.multiplier
            });

            if (comboResult.isMilestone) {
                this.events.emit('combo-milestone', { combo: comboResult.combo });
            }

            this.hitSounds.playHit(result.judgment, comboResult.combo);

            const addedScore = this.scoring.calculateScore(result.judgment, this.combo.multiplier);
            this._score += addedScore;

            this.state.updateScoreAndCombo(
                this._score,
                this.combo.combo,
                this.combo.multiplier
            );

            this.hitResults.push(result);
            this.state.addHitResult(result);
        } else {
            // Unused input, possibly near-miss
            const nearestDelta = this.tracker.getNearestNoteDelta(lane, time);
            if (nearestDelta !== null && Math.abs(nearestDelta) <= NEAR_MISS_WINDOW) {
                this.events.emit('near-miss', { lane });
            } else {
                this.events.emit('ghost-press', { lane });
            }
        }
    }

    public handleInputUp(lane: Lane, time: number): void {
        if (!this._isRunning) return;

        const result = this.tracker.judgeRelease(lane, time);
        if (result === 'miss') {
            this.handleAutoMiss("hold-release", lane);
        }
    }

    private handleAutoMiss(noteId: string, lane: Lane): void {
        const previousCombo = this.combo.combo;
        this.combo.hit('miss');

        if (previousCombo > 0) {
            this.events.emit('combo-break', { previousCombo });
        }
        this.events.emit('miss', { lane });

        this.state.updateScoreAndCombo(this._score, 0, 1);
        const hitResult: HitResult = {
            noteId,
            judgment: 'miss',
            delta: 0,
            comboAtHit: previousCombo
        };
        this.hitResults.push(hitResult);
        this.state.addHitResult(hitResult);
    }

    public pause(): void {
        this._isRunning = false;
        this.playback.pause();
        this.state.setPhase('paused');
        logInfo('game.pause', { score: this._score, combo: this.combo.combo });
        setGameSnapshot({ phase: 'paused' });
    }

    public resume(): void {
        // UI handles countdown, we just prep
        this.state.setPhase('playing');
        this._isRunning = true;
        this.playback.resume();
        logInfo('game.resume', {});
        setGameSnapshot({ phase: 'playing' });
    }

    public retry(): void {
        this._isRunning = false;
        this._hasStarted = false;
        this.playback.stop();
        this.scheduler.clear();
        this.tracker.reset();
        this.combo.reset();
        this._score = 0;
        this.hitResults = [];
        this.state.updateScoreAndCombo(0, 0, 1);

        // Seek to 0 so when playback starts again, it starts from beginning
        this.playback.seek(0);
        this.state.setPhase('countdown');
        logInfo('game.retry', {});
        setGameSnapshot({ score: 0, maxCombo: 0, phase: 'countdown' });
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
            this.hitResults,
            this.combo.maxCombo,
            this._score
        );

        this.state.setFinalScore(finalScore);
        this.state.setPhase('results');
        logInfo('game.end', {
            score: this._score,
            maxCombo: this.combo.maxCombo,
            hits: this.hitResults.filter(r => r.judgment !== 'miss').length,
            misses: this.hitResults.filter(r => r.judgment === 'miss').length,
        });
        setGameSnapshot({ score: this._score, maxCombo: this.combo.maxCombo, phase: 'results' });
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
