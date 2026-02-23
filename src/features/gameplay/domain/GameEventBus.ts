import { GameEvent } from '@/features/gameplay/domain/types';;

type EventHandler<T extends GameEvent['type']> = (
    data: Extract<GameEvent, { type: T }>['data']
) => void;

export class GameEventBus {
    private listeners: Map<string, Set<Function>> = new Map();

    public on<T extends GameEvent['type']>(event: T, handler: EventHandler<T>): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(handler);
    }

    public off<T extends GameEvent['type']>(event: T, handler: EventHandler<T>): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.delete(handler);
        }
    }

    public emit<T extends GameEvent['type']>(event: T, data: Extract<GameEvent, { type: T }>['data']): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            // Create a copy of the handlers array to avoid mutation issues during dispatch
            for (const handler of Array.from(eventListeners)) {
                handler(data);
            }
        }
    }

    public clear(): void {
        this.listeners.clear();
    }
}
