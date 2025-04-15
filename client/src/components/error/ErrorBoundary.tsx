/**
 * ErrorBoundary Component
 * 
 * A component that catches JavaScript errors anywhere in its child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  /** The component tree to render */
  children: ReactNode;
  /** Optional custom fallback UI component */
  fallback?: ReactNode;
  /** Whether to show the error details (stack trace) */
  showDetails?: boolean;
  /** Optional callback to run when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch and handle React rendering errors
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  /**
   * Update state when an error occurs in a child component
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  /**
   * Catch errors and update state with error info
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Call the optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Log the error to the console
    console.error('Error caught by ErrorBoundary:', error);
    console.error('Component stack trace:', errorInfo.componentStack);
    
    // In a production app, you might want to log this to an error monitoring service
    // logErrorToService(error, errorInfo);
  }

  /**
   * Reset the error state and try to re-render the component
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, showDetails = false } = this.props;

    if (hasError) {
      // Render custom fallback UI if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
          <div className="flex items-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
            <h2 className="text-lg font-semibold text-red-700">
              Something went wrong
            </h2>
          </div>
          
          <p className="text-red-600 mb-4">
            {error?.message || 'An unexpected error occurred'}
          </p>
          
          {showDetails && errorInfo && (
            <details className="mt-2 mb-4">
              <summary className="text-sm text-red-700 cursor-pointer">
                Error Details
              </summary>
              <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto">
                {error?.stack}
                <hr className="my-2" />
                {errorInfo.componentStack}
              </pre>
            </details>
          )}
          
          <button
            onClick={this.handleReset}
            className="flex items-center bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md shadow-sm transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Try Again
          </button>
        </div>
      );
    }

    // If there's no error, render the children
    return children;
  }
}

/**
 * Hook to create an error boundary around a component
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps: Omit<ErrorBoundaryProps, 'children'> = {}
): React.FC<P> {
  return (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
}

export default ErrorBoundary;