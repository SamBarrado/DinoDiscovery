import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled render error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid-overlay flex flex-col items-center justify-center p-4 text-center">
          <p className="text-cream font-semibold mb-4">
            Algo salió mal. Inténtalo de nuevo.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="px-6 py-3 min-h-[44px] bg-[#d1187f] text-white font-display2 font-semibold uppercase tracking-wide rounded-[999px]"
          >
            Volver al inicio
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
