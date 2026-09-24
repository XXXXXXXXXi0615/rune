/**
 * ErrorBoundary — reusable crash boundary for page/Dialog/panel level.
 *
 * Usage:
 *   <ErrorBoundary fallback="載入失敗" onBack={navigateToHome}>
 *     <YourComponent />
 *   </ErrorBoundary>
 *
 * Props:
 *   fallback   — heading text (default: "頁面載入失敗")
 *   onBack     — if provided, shows a "返回" button
 *   inline     — use compact style (for panels/dialogs, not full page)
 */
import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: string;
  description?: string;
  onBack?: () => void;
  onReload?: () => void;
  backLabel?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  testId?: string;
  inline?: boolean;
  /** When any value changes while in error state, the boundary resets (e.g. route pathname). */
  resetKeys?: ReadonlyArray<unknown>;
}

function resetKeysChanged(prev?: ReadonlyArray<unknown>, next?: ReadonlyArray<unknown>): boolean {
  if (prev === next) return false;
  if (!prev || !next || prev.length !== next.length) return true;
  return prev.some((value, index) => !Object.is(value, next[index]));
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, { hasError: boolean; errorMsg: string; componentStack: string }> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMsg: '', componentStack: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message || String(error) };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
    this.setState({ componentStack: info.componentStack });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && resetKeysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ hasError: false, errorMsg: '', componentStack: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      const minH = this.props.inline ? 'auto' : '60vh';
      return (
        <div data-testid={this.props.testId} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: minH, color: 'var(--text-3)', fontSize: 13, gap: 12, padding: 40, textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>
            {this.props.fallback || '頁面載入失敗'}
          </div>
          {this.props.description && (
            <div style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 360, lineHeight: 1.6 }}>
              {this.props.description}
            </div>
          )}
          <code style={{
            fontSize: 11, color: 'var(--danger)', maxWidth: 420,
            wordBreak: 'break-all', whiteSpace: 'pre-wrap', lineHeight: 1.5,
          }}>
            {this.state.errorMsg}
          </code>
          {this.state.componentStack && (
            <code style={{
              fontSize: 10, color: 'var(--text-3)', maxWidth: 420, textAlign: 'left',
              wordBreak: 'break-all', whiteSpace: 'pre-wrap', lineHeight: 1.4,
              padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8,
            }}>
              {this.state.componentStack}
            </code>
          )}
          {this.props.onBack && (
            <button
              type="button"
              onClick={this.props.onBack}
              style={{
                marginTop: 8, padding: '10px 22px', borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--glass-bg)', color: 'var(--text-2)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {this.props.backLabel || '返回'}
            </button>
          )}
          {this.props.onSecondary && (
            <button
              type="button"
              onClick={this.props.onSecondary}
              style={{ padding: '10px 22px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {this.props.secondaryLabel || '其他頁面'}
            </button>
          )}
          {this.props.onReload && (
            <button type="button" onClick={this.props.onReload} style={{ padding: '10px 22px', borderRadius: 12, border: 0, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>
              重新載入
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
