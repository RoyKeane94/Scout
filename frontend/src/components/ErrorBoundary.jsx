import { Component } from 'react';
import { logErrorToBackend } from '../utils/errorLogger';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    logErrorToBackend({
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      source: 'error_boundary',
      url: window.location.href,
      extra: { componentStack: errorInfo?.componentStack?.slice(0, 500) },
    });
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="page error-page">
          <div className="error-inner">
            <h1 className="error-title">Something went wrong</h1>
            <p className="error-message">
              We've been notified and will look into it. Please try again or go back.
            </p>
            <button
              type="button"
              className="error-btn"
              onClick={() => window.location.href = '/'}
            >
              Go to home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
