import React, { Component, ErrorInfo, ReactNode } from 'react';
import { NeoButton } from './NeoButton';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-neo-bg flex items-center justify-center p-6">
          <div className="max-w-md w-full border-4 border-black bg-white shadow-neo p-8">
            <h2 className="text-3xl font-black uppercase mb-4 text-neo-red">Something went wrong</h2>
            <p className="font-bold text-gray-600 mb-6">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <NeoButton 
              fullWidth 
              onClick={() => window.location.reload()}
              variant="primary"
            >
              Try Again
            </NeoButton>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
