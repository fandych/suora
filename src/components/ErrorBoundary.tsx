import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
  copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, errorId: '', copied: false }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `err-${Date.now().toString(36)}`,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorId: '', copied: false })
  }

  private handleCopy = async () => {
    const { error, errorInfo, errorId } = this.state
    const payload = [
      `Error ID: ${errorId}`,
      `Time: ${new Date().toISOString()}`,
      `Message: ${error?.message ?? 'unknown'}`,
      '',
      'Stack:',
      error?.stack ?? 'n/a',
      '',
      'Component Stack:',
      errorInfo?.componentStack ?? 'n/a',
      '',
      `UA: ${navigator.userAgent}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(payload)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    } catch {
      /* clipboard may be unavailable */
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { error, errorInfo, errorId, copied } = this.state
    const shortStack = error?.stack?.split('\n').slice(0, 6).join('\n')

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex items-center justify-center min-h-screen bg-surface-0 text-text-primary p-6"
      >
        <div className="w-full max-w-2xl space-y-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-red-500/15 text-red-400 text-xl shrink-0">
              !
            </div>
            <div>
              <h1 className="text-xl font-semibold text-text-primary">Something went wrong</h1>
              <p className="text-sm text-text-muted mt-1">
                The app hit an unexpected error. Your data is safe — try one of the options below.
              </p>
            </div>
          </div>

          <div className="bg-surface-1/80 border border-border-subtle rounded-lg p-4 space-y-3 text-sm">
            <div>
              <span className="text-text-muted text-xs uppercase tracking-wide">Message</span>
              <p className="font-mono text-danger content-wrap-anywhere mt-1">
                {error?.message || 'Unknown error'}
              </p>
            </div>
            {shortStack && (
              <details>
                <summary className="cursor-pointer text-text-muted hover:text-text-primary text-xs uppercase tracking-wide select-none">
                  Stack trace
                </summary>
                <pre className="mt-2 p-2 bg-surface-0 rounded text-[11px] leading-relaxed text-text-secondary overflow-auto max-h-48 whitespace-pre-wrap">
                  {shortStack}
                </pre>
              </details>
            )}
            {errorInfo?.componentStack && (
              <details>
                <summary className="cursor-pointer text-text-muted hover:text-text-primary text-xs uppercase tracking-wide select-none">
                  Component stack
                </summary>
                <pre className="mt-2 p-2 bg-surface-0 rounded text-[11px] leading-relaxed text-text-secondary overflow-auto max-h-48 whitespace-pre-wrap">
                  {errorInfo.componentStack.trim()}
                </pre>
              </details>
            )}
            <p className="text-xs text-text-muted">
              Error ID: <code className="bg-surface-2 px-1.5 py-0.5 rounded">{errorId}</code>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 bg-text-primary text-surface-0 hover:opacity-90 rounded-md text-sm font-medium transition-colors"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-md text-sm transition-colors"
            >
              Reload app
            </button>
            <button
              type="button"
              onClick={this.handleCopy}
              className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-md text-sm transition-colors"
              aria-live="polite"
            >
              {copied ? 'Copied ✓' : 'Copy error details'}
            </button>
          </div>

          <p className="text-xs text-text-muted">
            If the problem keeps happening, copy the error details above and share them with support.
          </p>
        </div>
      </div>
    )
  }
}
