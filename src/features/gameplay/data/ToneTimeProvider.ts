import * as Tone from 'tone';
import { ITimeProvider } from '@/features/gameplay/application/ports/ITimeProvider';

export class ToneTimeProvider implements ITimeProvider {
    getCurrentTime(): number {
        return Tone.getTransport().seconds;
    }
}
