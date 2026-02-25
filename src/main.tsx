import { logInfo, logError } from '@/core/logging'
import { initGameStoreLogger } from '@/state/gameStoreLogger'
import { ErrorBoundary } from '@/core/error/ErrorBoundary'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// ── Global error capture ──────────────────────────────────────────────────────

window.onerror = (msg, source, line, col, error) => {
    logError('app.uncaught.error', {
        message: typeof msg === 'string' ? msg : String(msg),
        source,
        line,
        col,
    }, error)
}

window.addEventListener('unhandledrejection', (event) => {
    logError('app.unhandled.rejection', {
        reason: String(event.reason),
    }, event.reason instanceof Error ? event.reason : undefined)
})

// ── Init ──────────────────────────────────────────────────────────────────────

logInfo('app.started', {
    userAgent: navigator.userAgent,
    screen: { w: window.innerWidth, h: window.innerHeight },
})

initGameStoreLogger()

// ── Render ────────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </StrictMode>,
)
