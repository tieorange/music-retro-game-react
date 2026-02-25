import { Component, type ReactNode, type ErrorInfo } from 'react';
import { logError, copyDebugLogs } from '@/core/logging';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, errorMessage: '' };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, errorMessage: error.message };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        logError('app.render.error', {
            componentStack: info.componentStack ?? undefined,
        }, error);
    }

    render(): ReactNode {
        if (!this.state.hasError) return this.props.children;

        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: '#0a0a1a',
                color: '#fff',
                fontFamily: 'monospace',
                padding: 24,
                textAlign: 'center',
            }}>
                <h1 style={{ color: '#ff00ff', fontSize: 28, marginBottom: 16 }}>
                    CRITICAL ERROR
                </h1>
                <p style={{ color: '#ff6b6b', marginBottom: 24, maxWidth: 480 }}>
                    {this.state.errorMessage}
                </p>
                <button
                    onClick={() => { void copyDebugLogs(); }}
                    style={{
                        background: '#00ffff',
                        color: '#000',
                        border: 'none',
                        padding: '12px 24px',
                        cursor: 'pointer',
                        fontSize: 16,
                        fontWeight: 'bold',
                        fontFamily: 'monospace',
                        marginBottom: 12,
                    }}
                >
                    COPY DEBUG LOGS
                </button>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        background: 'transparent',
                        color: '#888',
                        border: '1px solid #444',
                        padding: '10px 20px',
                        cursor: 'pointer',
                        fontSize: 14,
                        fontFamily: 'monospace',
                    }}
                >
                    RELOAD APP
                </button>
            </div>
        );
    }
}
