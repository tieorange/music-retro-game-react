export type Grade = 'S' | 'A' | 'B' | 'C';

export interface GameScore {
    songId: string;
    songName: string;
    totalNotes: number;
    perfects: number;
    greats: number;
    goods: number;
    misses: number;
    maxCombo: number;
    score: number;
    accuracy: number;        // 0-100
    grade: Grade;
    date: number;            // unix timestamp
}
