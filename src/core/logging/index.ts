export {
    logger,
    logDebug,
    logInfo,
    logWarn,
    logError,
    setFlowId,
    resetFlowId,
    setGameSnapshot,
    setAnalysisSnapshot,
    getDebugLogPackage,
    copyDebugLogs,
} from './logger';

export type { ILogger, LogEntry, DebugLogPackage } from './logger';
