import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary Component
 * 
 * This component catches JavaScript errors anywhere in its child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  // Updated when props change if resetOnPropsChange is true
  static getDerivedStateFromProps(props: Props, state: State) {
    if (props.resetOnPropsChange && state.hasError) {
      return {
        hasError: false,
        error: null
      };
    }
    return null;
  }

  // Update state when error occurs
  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  // Log error details
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    
    // Call optional onError handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  // Reset the error state
  resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Show custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Default fallback UI
      return (
        <div className="p-4 border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-md my-4">
          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 mb-2">
            <AlertCircle className="h-5 w-5" />
            <h3 className="text-lg font-medium">Something went wrong</h3>
          </div>
          
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            The application encountered an unexpected error. Try refreshing the page.
          </p>
          
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono overflow-auto max-h-32">
              {this.state.error.toString()}
            </div>
          )}
          
          <button
            onClick={this.resetErrorBoundary}
            className="mt-3 flex items-center space-x-1 px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800/60 text-red-700 dark:text-red-300 rounded"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;