import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { logErrorToBackend } from './utils/errorLogger'

// Global error handlers – log to backend and redirect to error page
window.addEventListener('error', (e) => {
  logErrorToBackend({
    message: e.message || 'Uncaught error',
    stack: e.error?.stack,
    source: 'unhandled',
    url: window.location.href,
  });
  if (!e.message?.includes('ResizeObserver')) {
    window.location.replace(`/error?message=${encodeURIComponent(e.message || 'Something went wrong')}`);
  }
});

window.addEventListener('unhandledrejection', (e) => {
  e.preventDefault();
  const msg = e.reason?.message || String(e.reason || 'Unhandled promise rejection');
  logErrorToBackend({
    message: msg,
    stack: e.reason?.stack,
    source: 'unhandledrejection',
    url: window.location.href,
  });
  window.location.replace(`/error?message=${encodeURIComponent(msg)}`);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
