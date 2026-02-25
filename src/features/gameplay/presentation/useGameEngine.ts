import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/state/gameStore';
import { logError, logInfo, logWarn } from '@/core/logging';
import { GameEngine } from '../application/GameEngine';
import { AudioPlaybackService } from '@/features/audio/data/audioPlayback';
import { AudioMixer } from '@/features/audio/data/AudioMixer';
import { IGameStatePort } from '../application/ports/IGameStatePort';
import { NoteScheduler } from '../data/NoteScheduler';
import { HitSoundService } from '../data/hitSounds';
import { ToneTimeProvider } from '../data/ToneTimeProvider';
import { NoteTracker } from '../domain/NoteTracker';

export function useGameEngine() {
    const phase = useGameStore(s => s.phase);
    const musicVolume = useGameStore(s => s.musicVolume);
    const sfxVolume = useGameStore(s => s.sfxVolume);
    const masterVolume = useGameStore(s => s.masterVolume);

    const engineRef = useRef<GameEngine | null>(null);
    const mixerRef = useRef<AudioMixer | null>(null);
    const initializingRef = useRef(false);
    const [engine, setEngine] = useState<GameEngine | null>(null);

    useEffect(() => {
        let mounted = true;

        const currentSong = useGameStore.getState().song;
        const currentBeatMap = useGameStore.getState().beatMap;

        if (!engineRef.current &&
            !initializingRef.current &&
            currentSong?.audioBuffer &&
            currentBeatMap) {

            initializingRef.current = true;
            logInfo('game.useengine.init.started', { songId: currentSong.id });

            const mixer = new AudioMixer();
            mixerRef.current = mixer;
            mixer.setMusicVolume(useGameStore.getState().musicVolume);
            mixer.setSfxVolume(useGameStore.getState().sfxVolume);
            mixer.setMasterVolume(useGameStore.getState().masterVolume);

            const playback = new AudioPlaybackService(mixer);

            const stateAdapter: IGameStatePort = {
                get song() { return useGameStore.getState().song; },
                setCurrentTime: (time) => useGameStore.getState().setCurrentTime(time),
                setPhase: (phase) => useGameStore.getState().setPhase(phase),
                updateScoreAndCombo: (score, combo, multiplier) => useGameStore.getState().updateScoreAndCombo(score, combo, multiplier),
                addHitResult: (result) => useGameStore.getState().addHitResult(result),
                setFinalScore: (score) => useGameStore.getState().setFinalScore(score)
            };

            const initialize = async () => {
                try {
                    await playback.load(currentSong!.audioBuffer!);
                    useGameStore.getState().clearAudioBuffer();

                    if (useGameStore.getState().phase === 'countdown') {
                        await playback.warmUp();
                    }

                    if (!mounted) {
                        playback.destroy();
                        return;
                    }

                    const hitSounds = new HitSoundService(mixer);
                    await hitSounds.init();

                    const localEngine = new GameEngine(
                        currentBeatMap!,
                        playback,
                        stateAdapter,
                        new NoteScheduler(),
                        hitSounds,
                        new ToneTimeProvider(),
                        new NoteTracker()
                    );
                    engineRef.current = localEngine;

                    localEngine.events.on('hit', (data) => {
                        logInfo('game.input.hit', {
                            judgment: data.judgment,
                            lane: data.lane,
                            combo: data.combo,
                        });
                    });
                    localEngine.events.on('miss', (data) => {
                        logInfo('game.input.miss', { lane: data.lane });
                    });
                    localEngine.events.on('combo-break', (data) => {
                        logWarn('game.combo.break', { previousCombo: data.previousCombo });
                    });

                    setEngine(localEngine);
                    logInfo('game.useengine.init.success', {});
                } catch (error) {
                    logError('game.engine.init.failed', {}, error);
                    playback.destroy();
                    if (mounted) {
                        useGameStore.getState().setPhase('idle');
                    }
                }
            };

            initialize();
        }

        return () => {
            logInfo('game.useengine.unmounted', { hadEngine: !!engineRef.current });
            mounted = false;

            if (engineRef.current) {
                engineRef.current.destroy();
                engineRef.current = null;
                setEngine(null);
            }
            if (mixerRef.current) {
                mixerRef.current.destroy();
                mixerRef.current = null;
            }
            initializingRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (phase === 'playing' && engine && !engine.isRunning) {
            engine.start().catch((err) => {
                if (err.message !== "disposed") {
                    logError('game.engine.start.failed', {}, err);
                }
            });
        }
    }, [phase, engine]);

    useEffect(() => {
        if (mixerRef.current) {
            mixerRef.current.setMusicVolume(musicVolume);
            mixerRef.current.setSfxVolume(sfxVolume);
            mixerRef.current.setMasterVolume(masterVolume);
        }
    }, [musicVolume, sfxVolume, masterVolume]);

    return engine;
}
