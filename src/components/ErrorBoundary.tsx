import { Component, type ReactNode, type ErrorInfo } from 'react';
import { t as translate } from '@/services/i18n';
import { logger, reportRendererCrash } from '@/services/logger';
import { Button as UiButton } from "@/components/catalyst-ui/button";
interface Props {
    children: ReactNode;
}
interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    errorId: string;
    copied: boolean;
}
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null, errorId: '', copied: false };
    }
    static getDerivedStateFromError(error: Error): Partial<State> {
        return {
            hasError: true,
            error,
            errorId: `err-${Date.now().toString(36)}`,
        };
    }
    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        const meta = {
            errorId: this.state.errorId,
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
        };
        logger.error('[ErrorBoundary] Uncaught error', meta);
        void reportRendererCrash(error, 'react:error-boundary', meta);
        this.setState({ errorInfo });
    }
    private handleReload = () => {
        window.location.reload();
    };
    private handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null, errorId: '', copied: false });
    };
    private handleCopy = async () => {
        const { error, errorInfo, errorId } = this.state;
        const payload = [
            `${translate('errorBoundary.errorId', 'Error ID')}: ${errorId}`,
            `${translate('errorBoundary.time', 'Time')}: ${new Date().toISOString()}`,
            `${translate('errorBoundary.message', 'Message')}: ${error?.message ?? translate('errorBoundary.unknownError', 'Unknown error')}`,
            '',
            `${translate('errorBoundary.stackTrace', 'Stack trace')}:`,
            error?.stack ?? 'n/a',
            '',
            `${translate('errorBoundary.componentStack', 'Component stack')}:`,
            errorInfo?.componentStack ?? 'n/a',
            '',
            `${translate('errorBoundary.userAgent', 'User agent')}: ${navigator.userAgent}`,
        ].join('\n');
        try {
            await navigator.clipboard.writeText(payload);
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        }
        catch {
            /* clipboard may be unavailable */
        }
    };
    render() {
        if (!this.state.hasError)
            return this.props.children;
        const { error, errorInfo, errorId, copied } = this.state;
        const shortStack = error?.stack?.split('\n').slice(0, 6).join('\n');
        const title = translate('errorBoundary.title', 'Something went wrong');
        const description = translate('errorBoundary.description', 'The app hit an unexpected error. Your data is safe - try one of the options below.');
        const messageLabel = translate('errorBoundary.message', 'Message');
        const unknownErrorLabel = translate('errorBoundary.unknownError', 'Unknown error');
        const stackTraceLabel = translate('errorBoundary.stackTrace', 'Stack trace');
        const componentStackLabel = translate('errorBoundary.componentStack', 'Component stack');
        const errorIdLabel = translate('errorBoundary.errorId', 'Error ID');
        const reloadAppLabel = translate('errorBoundary.reloadApp', 'Reload app');
        const copyDetailsLabel = translate('errorBoundary.copyDetails', 'Copy error details');
        const copiedLabel = translate('errorBoundary.copied', 'Copied');
        const supportHint = translate('errorBoundary.supportHint', 'If the problem keeps happening, copy the error details above and share them with support.');
        return (<div role="alert" aria-live="assertive" className="flex items-center justify-center min-h-screen bg-surface-0 text-text-primary p-6">
        <div className="w-full max-w-2xl space-y-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-red-500/15 text-red-400 text-xl shrink-0">
              !
            </div>
            <div>
              <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
              <p className="text-sm text-text-muted mt-1">
                {description}
              </p>
            </div>
          </div>

          <div className="bg-surface-1/80 border border-border-subtle rounded-lg p-4 space-y-3 text-sm">
            <div>
              <span className="text-text-muted text-xs uppercase tracking-wide">{messageLabel}</span>
              <p className="font-mono text-danger content-wrap-anywhere mt-1">
                {error?.message || unknownErrorLabel}
              </p>
            </div>
            {shortStack && (<details>
                <summary className="cursor-pointer text-text-muted hover:text-text-primary text-xs uppercase tracking-wide select-none">
                  {stackTraceLabel}
                </summary>
                <pre className="mt-2 p-2 bg-surface-0 rounded text-[11px] leading-relaxed text-text-secondary overflow-auto max-h-48 whitespace-pre-wrap">
                  {shortStack}
                </pre>
              </details>)}
            {errorInfo?.componentStack && (<details>
                <summary className="cursor-pointer text-text-muted hover:text-text-primary text-xs uppercase tracking-wide select-none">
                  {componentStackLabel}
                </summary>
                <pre className="mt-2 p-2 bg-surface-0 rounded text-[11px] leading-relaxed text-text-secondary overflow-auto max-h-48 whitespace-pre-wrap">
                  {errorInfo.componentStack.trim()}
                </pre>
              </details>)}
            <p className="text-xs text-text-muted">
              {errorIdLabel}: <code className="bg-surface-2 px-1.5 py-0.5 rounded">{errorId}</code>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <UiButton unstyled type="button" onClick={this.handleReset} className="px-4 py-2 bg-text-primary text-surface-0 hover:opacity-90 rounded-md text-sm font-medium transition-colors">
              {translate('common.retry', 'Retry')}
            </UiButton>
            <UiButton unstyled type="button" onClick={this.handleReload} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-md text-sm transition-colors">
              {reloadAppLabel}
            </UiButton>
            <UiButton unstyled type="button" onClick={this.handleCopy} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-md text-sm transition-colors" aria-live="polite">
              {copied ? `${copiedLabel} ✓` : copyDetailsLabel}
            </UiButton>
          </div>

          <p className="text-xs text-text-muted">
            {supportHint}
          </p>
        </div>
      </div>);
    }
}

