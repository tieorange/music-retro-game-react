import { useEffect, useState, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useGameStore } from '@/state/gameStore';
import { logInfo, logError, setFlowId, setAnalysisSnapshot } from '@/core/logging';
import { BeatAnalysisService } from '@/features/analysis/data/beatAnalysisService';
import { generateBeatMap } from '../domain/beatMapGenerator';

export function useBeatAnalysis() {
    const song = useGameStore((state) => state.song);
    const mode = useGameStore((state) => state.mode);
    const difficulty = useGameStore((state) => state.difficulty);
    const setBeatMap = useGameStore((state) => state.setBeatMap);
    const setPhase = useGameStore((state) => state.setPhase);

    const [progressPercent, setProgressPercent] = useState(0);
    const [progressStage, setProgressStage] = useState('Initializing...');
    const [error, setError] = useState<string | null>(null);

    const hasStarted = useRef(false);

    useEffect(() => {
        if (!song || hasStarted.current) return;
        hasStarted.current = true;
        let cancelled = false;

        const analysisService = new BeatAnalysisService();

        if (!song.audioBuffer) {
            setError("Audio buffer is missing.");
            return;
        }

        setFlowId(nanoid());
        logInfo('analysis.started', {
            duration: song.audioBuffer.duration,
            sampleRate: song.audioBuffer.sampleRate,
            numberOfChannels: song.audioBuffer.numberOfChannels,
        });

        analysisService.analyze(song.audioBuffer, (stage, percent) => {
            if (!cancelled) { setProgressStage(stage); setProgressPercent(percent); }
        })
            .then((analysis) => {
                if (!cancelled) {
                    logInfo('analysis.beatmap.generated', {
                        bpm: analysis.bpm,
                        beatCount: analysis.beats.length,
                        confidence: analysis.confidence,
                        mode,
                        difficulty,
                    });
                    setAnalysisSnapshot({ bpm: analysis.bpm, beatCount: analysis.beats.length });
                    const beatMap = generateBeatMap(song.id, analysis, mode, difficulty);
                    setBeatMap(beatMap);
                    setPhase('ready');
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    logError('analysis.failed', {}, err);
                    setError(err.message);
                }
            });

        return () => {
            cancelled = true;
            hasStarted.current = false;
        };
    }, [song, mode, difficulty, setBeatMap, setPhase]);

    return { progressPercent, progressStage, error };
}
