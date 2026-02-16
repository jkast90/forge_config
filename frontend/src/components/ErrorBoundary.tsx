import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRecover = () => {
    this.setState({ hasError: false, error: null, componentStack: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        textAlign: 'center',
        background: 'var(--bg-primary, #1a1a2e)',
        color: 'var(--text-primary, #e0e0e0)',
      }}>
        <Icon name="error" size={48} />
        <h2 style={{ margin: '1rem 0 0.5rem' }}>Something went wrong</h2>
        <p style={{ color: 'var(--text-secondary, #a0a0a0)', maxWidth: 480, marginBottom: '1.5rem' }}>
          An unexpected error occurred. You can try recovering or reload the page.
        </p>
        {this.state.error && (
          <div style={{ maxWidth: 720, width: '100%', marginBottom: '1.5rem', textAlign: 'left' }}>
            <div style={{
              background: 'var(--color-error-bg, rgba(239, 68, 68, 0.15))',
              border: '1px solid var(--color-error, #ef4444)',
              borderRadius: '8px 8px 0 0',
              padding: '0.75rem 1rem',
              fontWeight: 600,
              color: 'var(--color-error, #ef4444)',
              fontSize: '0.9rem',
            }}>
              {this.state.error.message}
            </div>
            {this.state.error.stack && (
              <pre style={{
                background: 'var(--bg-secondary, #16213e)',
                padding: '0.75rem 1rem',
                margin: 0,
                borderLeft: '1px solid var(--color-error, #ef4444)',
                borderRight: '1px solid var(--color-error, #ef4444)',
                overflow: 'auto',
                maxHeight: 200,
                fontSize: '0.75rem',
                lineHeight: 1.5,
                color: 'var(--text-secondary, #a0a0a0)',
              }}>
                {this.state.error.stack}
              </pre>
            )}
            {this.state.componentStack && (
              <>
                <div style={{
                  background: 'var(--bg-secondary, #16213e)',
                  padding: '0.5rem 1rem',
                  borderLeft: '1px solid var(--color-error, #ef4444)',
                  borderRight: '1px solid var(--color-error, #ef4444)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-primary, #e0e0e0)',
                  borderTop: '1px solid var(--border-primary, rgba(255,255,255,0.1))',
                }}>
                  Component Stack
                </div>
                <pre style={{
                  background: 'var(--bg-secondary, #16213e)',
                  padding: '0.75rem 1rem',
                  margin: 0,
                  border: '1px solid var(--color-error, #ef4444)',
                  borderRadius: '0 0 8px 8px',
                  overflow: 'auto',
                  maxHeight: 200,
                  fontSize: '0.75rem',
                  lineHeight: 1.5,
                  color: 'var(--text-secondary, #a0a0a0)',
                }}>
                  {this.state.componentStack}
                </pre>
              </>
            )}
            {!this.state.componentStack && (
              <div style={{
                borderRadius: '0 0 8px 8px',
                borderLeft: '1px solid var(--color-error, #ef4444)',
                borderRight: '1px solid var(--color-error, #ef4444)',
                borderBottom: '1px solid var(--color-error, #ef4444)',
                height: 0,
              }} />
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="secondary" onClick={this.handleRecover}>
            <Icon name="refresh" size={14} />
            Try to Recover
          </Button>
          <Button variant="primary" onClick={this.handleReload}>
            <Icon name="restart_alt" size={14} />
            Reload Page
          </Button>
        </div>
      </div>
    );
  }
}
