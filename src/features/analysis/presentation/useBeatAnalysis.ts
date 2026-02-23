import { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@/state/gameStore';
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

        const analysisService = new BeatAnalysisService();

        analysisService.analyze(song.audioBuffer, (stage, percent) => {
            setProgressStage(stage);
            setProgressPercent(percent);
        })
            .then((analysis) => {
                console.log('Analysis complete:', analysis);
                const beatMap = generateBeatMap(song.id, analysis, mode, difficulty);
                setBeatMap(beatMap);
                setPhase('ready');
            })
            .catch((err) => {
                setError(err.message);
            });
    }, [song, mode, difficulty, setBeatMap, setPhase]);

    return { progressPercent, progressStage, error };
}
