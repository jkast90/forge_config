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
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRecover = () => {
    this.setState({ hasError: false, error: null });
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
          <pre style={{
            background: 'var(--bg-secondary, #16213e)',
            padding: '1rem',
            borderRadius: 8,
            maxWidth: 600,
            width: '100%',
            overflow: 'auto',
            fontSize: '0.8rem',
            marginBottom: '1.5rem',
            textAlign: 'left',
            color: 'var(--color-error, #ef4444)',
          }}>
            {this.state.error.message}
          </pre>
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
