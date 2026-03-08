import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { logErrorToBackend } from '../utils/errorLogger';

/** Logs 404 and redirects to error page. */
export default function NotFound() {
  useEffect(() => {
    logErrorToBackend({
      message: 'Page not found',
      source: '404',
      url: window.location.href,
    });
  }, []);

  return <Navigate to="/error?message=Page+not+found" replace />;
}
