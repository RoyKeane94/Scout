import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function Error() {
  const [searchParams] = useSearchParams();
  const message = searchParams.get('message') || 'Something went wrong';
  const code = searchParams.get('code') || '';

  useEffect(() => {
    document.title = 'Error — Scout';
  }, []);

  return (
    <div className="page error-page">
      <div className="error-inner">
        <div className="error-icon">!</div>
        <h1 className="error-title">Something went wrong</h1>
        <p className="error-message">
          {decodeURIComponent(message)}
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
