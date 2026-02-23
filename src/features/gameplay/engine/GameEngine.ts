import { BeatMap, Lane } from '@/domain/types';
import { AudioPlaybackService } from '@/infrastructure/audio/audioPlayback';
import { NoteScheduler } from './NoteScheduler';
import { NoteTracker } from './NoteTracker';
import { ScoringEngine } from '@/features/gameplay/scoring/ScoringEngine';
import { ComboTracker } from '@/features/gameplay/scoring/ComboTracker';
import { GameStore } from '@/shared/stores/gameStore';

export class GameEngine {
    private playback: AudioPlaybackService;
    private scheduler: NoteScheduler;
    private tracker: NoteTracker;
    private scoring: ScoringEngine;
    private combo: ComboTracker;
    private getStore: () => GameStore;
    private beatMap: BeatMap;
    private isRunning: boolean = false;

    constructor(beatMap: BeatMap, playback: AudioPlaybackService, getStore: () => GameStore) {
        this.playback = playback;
        this.getStore = getStore;
        this.beatMap = beatMap;

        this.scheduler = new NoteScheduler();
        this.tracker = new NoteTracker(beatMap.notes, this.handleAutoMiss.bind(this));
        this.scoring = new ScoringEngine();
        this.combo = new ComboTracker();
    }

    public async start(): Promise<void> {
        this.scheduler.scheduleAll(this.beatMap.notes, (note) => {
            this.tracker.spawnNote(note);
            // We don't need to explicitly push to Zustand activeNotes if we pull from tracker, 
            // but for React/Pixi bridge it's better to update active notes if needed, or simply read from GameEngine.
            // We'll let the Ticker pull from gameEngine.getActiveNotes().
        });

        await this.playback.start();
        this.isRunning = true;
    }

    public update(currentTime: number): void {
        if (!this.isRunning) return;

        this.tracker.update(currentTime);
        this.getStore().setCurrentTime(currentTime);

        // Check for song end
        const state = this.getStore();
        if (state.song && currentTime >= state.song.duration + 2.0) {
            this.endGame();
        }
    }

    public handleInput(lane: Lane, time: number): void {
        if (!this.isRunning) return;

        const result = this.tracker.judgeHit(lane, time);
        if (result) {
            this.combo.hit(result.judgment);
            result.comboAtHit = this.combo.combo;

            const addedScore = this.scoring.calculateScore(result.judgment, this.combo.multiplier);
            const state = this.getStore();

            state.updateScoreAndCombo(
                state.score + addedScore,
                this.combo.combo,
                this.combo.multiplier
            );

            state.addHitResult(result);
        }
    }

    private handleAutoMiss(noteId: string): void {
        const state = this.getStore();
        this.combo.hit('miss');
        state.updateScoreAndCombo(state.score, 0, 1);
        state.addHitResult({
            noteId,
            judgment: 'miss',
            delta: 0,
            comboAtHit: 0
        });
    }

    public pause(): void {
        this.isRunning = false;
        this.playback.pause();
    }

    public resume(): void {
        this.isRunning = true;
        this.playback.resume();
    }

    public endGame(): void {
        this.isRunning = false;
        this.playback.stop();
        this.scheduler.clear();

        // Calculate final score
        const state = this.getStore();
        if (!state.song) return;

        const finalScore = this.scoring.calculateFinalScore(
            state.song.id,
            state.song.name,
            this.beatMap.notes.length,
            state.hitResults,
            this.combo.maxCombo,
            state.score
        );

        state.setFinalScore(finalScore);
        state.setPhase('results');
    }

    public destroy(): void {
        this.isRunning = false;
        this.scheduler.clear();
        this.playback.destroy();
    }

    public getActiveNotes() {
        return this.tracker.getActiveNotes();
    }
}
