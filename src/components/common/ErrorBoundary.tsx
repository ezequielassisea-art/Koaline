import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
  message?: string;
  fullScreen?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
  retryKey: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Erro de renderização capturado pelo ErrorBoundary:', error, info.componentStack);
  }

  private retry = () => this.setState((state) => ({ error: null, retryKey: state.retryKey + 1 }));

  render() {
    const { error, retryKey } = this.state;
    if (error) {
      return (
        <main className={this.props.fullScreen === false ? 'flex h-full min-h-[320px] w-full flex-1 items-center justify-center overflow-auto px-6 text-center' : 'app-shell flex h-screen w-screen items-center justify-center overflow-auto px-6 text-center'} role="alert">
          <section className="max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-7 shadow-2xl">
            <h1 className="mb-2 text-xl font-bold text-white">{this.props.title || 'Algo deu errado'}</h1>
            <p className="mb-5 text-sm leading-6 text-slate-300">{this.props.message || 'Ocorreu um erro ao exibir esta tela. Tente novamente.'}</p>
            <details className="mb-5 text-left text-xs text-slate-500">
              <summary className="cursor-pointer">Detalhes do erro</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">{error.message}</pre>
            </details>
            <button type="button" onClick={this.retry} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Tentar novamente</button>
          </section>
        </main>
      );
    }

    return <React.Fragment key={retryKey}>{this.props.children}</React.Fragment>;
  }
}

export default ErrorBoundary;
