import { Note } from '../../gameplay/domain/types';

export interface BeatAnalysis {
    bpm: number;
    beats: number[];          // timestamps in seconds
    confidence: number;       // 0-1
    beatStrengths?: number[]; // onset strength per beat, parallel array to beats
}

export interface BeatMap {
    songId: string;
    bpm: number;
    notes: Note[];
}
