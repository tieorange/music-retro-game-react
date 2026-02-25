import { nanoid } from 'nanoid';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LogEntry {
    ts: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    event: string;
    sessionId: string;
    flowId?: string;
    phase?: string;
    data?: Record<string, unknown>;
    error?: {
        name?: string;
        message: string;
        stack?: string;
        cause?: string;
    };
}

export interface DebugLogPackage {
    meta: {
        app: string;
        version: string;
        exportedAt: string;
        sessionId: string;
        flowId: string | undefined;
        userAgent: string;
        screen: { w: number; h: number };
        phase: string | undefined;
        audioContextState: string;
    };
    summary: {
        errorCount: number;
        warnCount: number;
        lastError: LogEntry | null;
        analysis: { bpm?: number; beatCount?: number };
        game: { score?: number; maxCombo?: number };
    };
    logs: LogEntry[];
}

// ─── ILogger Interface ────────────────────────────────────────────────────────
// Consumers depend on this contract. Swap the implementation in one place.

export interface ILogger {
    debug(event: string, data?: Record<string, unknown>): void;
    info(event: string, data?: Record<string, unknown>): void;
    warn(event: string, data?: Record<string, unknown>, error?: unknown): void;
    error(event: string, data?: Record<string, unknown>, error?: unknown): void;

    setFlowId(id: string): void;
    resetFlowId(): void;

    setGameSnapshot(snap: { score?: number; maxCombo?: number; phase?: string }): void;
    setAnalysisSnapshot(snap: { bpm?: number; beatCount?: number }): void;

    getDebugLogPackage(): DebugLogPackage;
    copyDebugLogs(): Promise<void>;
}

// ─── Logger Implementation ────────────────────────────────────────────────────

const RING_BUFFER_SIZE = 2000;
const LEVEL_RANK: Record<LogEntry['level'], number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

function serializeError(raw: unknown): LogEntry['error'] | undefined {
    if (raw === undefined || raw === null) return undefined;
    if (raw instanceof Error) {
        const cause = (raw as unknown as Record<string, unknown>).cause;
        return {
            name: raw.name,
            message: raw.message,
            stack: raw.stack,
            cause: cause != null ? String(cause) : undefined,
        };
    }
    return { message: String(raw) };
}

class Logger implements ILogger {
    private readonly _sessionId: string = nanoid();
    private _flowId: string | null = null;
    private _gameSnap: { score?: number; maxCombo?: number; phase?: string } = {};
    private _analysisSnap: { bpm?: number; beatCount?: number } = {};

    // Ring buffer
    private readonly _buffer: LogEntry[] = new Array(RING_BUFFER_SIZE);
    private _head = 0;
    private _count = 0;

    private readonly _isDev: boolean = import.meta.env.DEV;
    private readonly _minLevel: LogEntry['level'] = import.meta.env.DEV ? 'debug' : 'info';

    // ── Flow ID ───────────────────────────────────────────────────────────────

    setFlowId(id: string): void {
        this._flowId = id;
    }

    resetFlowId(): void {
        this._flowId = null;
    }

    // ── Snapshots ─────────────────────────────────────────────────────────────

    setGameSnapshot(snap: { score?: number; maxCombo?: number; phase?: string }): void {
        this._gameSnap = { ...this._gameSnap, ...snap };
    }

    setAnalysisSnapshot(snap: { bpm?: number; beatCount?: number }): void {
        this._analysisSnap = { ...this._analysisSnap, ...snap };
    }

    // ── Ring buffer helpers ───────────────────────────────────────────────────

    private _push(entry: LogEntry): void {
        this._buffer[this._head] = entry;
        this._head = (this._head + 1) % RING_BUFFER_SIZE;
        if (this._count < RING_BUFFER_SIZE) this._count++;
    }

    private _getEntries(): LogEntry[] {
        if (this._count < RING_BUFFER_SIZE) {
            return this._buffer.slice(0, this._count);
        }
        // Buffer has wrapped — oldest entry is at _head
        return [...this._buffer.slice(this._head), ...this._buffer.slice(0, this._head)];
    }

    // ── Core write ────────────────────────────────────────────────────────────

    private _write(
        level: LogEntry['level'],
        event: string,
        data?: Record<string, unknown>,
        error?: unknown,
    ): void {
        if (LEVEL_RANK[level] < LEVEL_RANK[this._minLevel]) return;

        const entry: LogEntry = {
            ts: new Date().toISOString(),
            level,
            event,
            sessionId: this._sessionId,
            ...(this._flowId != null ? { flowId: this._flowId } : {}),
            ...(this._gameSnap.phase != null ? { phase: this._gameSnap.phase } : {}),
            ...(data != null ? { data } : {}),
            ...(error !== undefined ? { error: serializeError(error) } : {}),
        };

        this._push(entry);

        // Console sink — the ONLY place in the app calling console.*
        if (this._isDev) {
            const method =
                level === 'error' ? console.error :
                level === 'warn'  ? console.warn  :
                level === 'info'  ? console.info  :
                console.debug;
            method(`[${event}]`, entry);
        }
    }

    // ── Public ILogger API ────────────────────────────────────────────────────

    debug(event: string, data?: Record<string, unknown>): void {
        this._write('debug', event, data);
    }

    info(event: string, data?: Record<string, unknown>): void {
        this._write('info', event, data);
    }

    warn(event: string, data?: Record<string, unknown>, error?: unknown): void {
        this._write('warn', event, data, error);
    }

    error(event: string, data?: Record<string, unknown>, error?: unknown): void {
        this._write('error', event, data, error);
    }

    // ── Export ────────────────────────────────────────────────────────────────

    getDebugLogPackage(): DebugLogPackage {
        const logs = this._getEntries();
        const errors = logs.filter(e => e.level === 'error');
        const warns  = logs.filter(e => e.level === 'warn');

        let audioContextState = 'unknown';
        try {
            audioContextState =
                (window as unknown as Record<string, any>).Tone?.context?.state ?? 'unknown';
        } catch {
            // not available in worker or test contexts
        }

        return {
            meta: {
                app: 'pixel-beat',
                version: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.0.0',
                exportedAt: new Date().toISOString(),
                sessionId: this._sessionId,
                flowId: this._flowId ?? undefined,
                userAgent: navigator.userAgent,
                screen: { w: window.innerWidth, h: window.innerHeight },
                phase: this._gameSnap.phase,
                audioContextState,
            },
            summary: {
                errorCount: errors.length,
                warnCount: warns.length,
                lastError: errors.length > 0 ? errors[errors.length - 1] : null,
                analysis: { ...this._analysisSnap },
                game: { score: this._gameSnap.score, maxCombo: this._gameSnap.maxCombo },
            },
            logs,
        };
    }

    async copyDebugLogs(): Promise<void> {
        const pkg = this.getDebugLogPackage();
        const text = JSON.stringify(pkg, null, 2);
        try {
            await navigator.clipboard.writeText(text);
            console.info('[PixelBeat] Debug logs copied to clipboard ✓');
        } catch {
            console.warn('[PixelBeat] Clipboard write failed. Dumping to console:');
            console.log(text);
        }
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
// To swap the implementation, change what `logger` points to here.

export const logger: ILogger = new Logger();

// ─── Convenience functions ────────────────────────────────────────────────────
// Thin wrappers so call-sites stay clean: logInfo('event', { ... })

export const logDebug = (event: string, data?: Record<string, unknown>): void =>
    logger.debug(event, data);

export const logInfo = (event: string, data?: Record<string, unknown>): void =>
    logger.info(event, data);

export const logWarn = (event: string, data?: Record<string, unknown>, error?: unknown): void =>
    logger.warn(event, data, error);

export const logError = (event: string, data?: Record<string, unknown>, error?: unknown): void =>
    logger.error(event, data, error);

export const setFlowId = (id: string): void => logger.setFlowId(id);
export const resetFlowId = (): void => logger.resetFlowId();
export const setGameSnapshot = (snap: Parameters<ILogger['setGameSnapshot']>[0]): void =>
    logger.setGameSnapshot(snap);
export const setAnalysisSnapshot = (snap: Parameters<ILogger['setAnalysisSnapshot']>[0]): void =>
    logger.setAnalysisSnapshot(snap);
export const getDebugLogPackage = (): DebugLogPackage => logger.getDebugLogPackage();
export const copyDebugLogs = (): Promise<void> => logger.copyDebugLogs();

// ─── Dev Escape Hatch ─────────────────────────────────────────────────────────

if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__pixelBeatDebug = {
        getPackage: getDebugLogPackage,
        copy: copyDebugLogs,
        logger,
    };
}
