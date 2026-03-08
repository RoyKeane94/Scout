/**
 * Logs errors to the backend ErrorLog model.
 * Uses fetch directly to avoid axios interceptors (e.g. 401 redirect).
 */
export function logErrorToBackend({ message, stack, source, url, extra = {} }) {
  const token = localStorage.getItem('token');
  const payload = {
    message: typeof message === 'string' ? message : String(message),
    stack: stack || null,
    source: source || 'unknown',
    url: url || (typeof window !== 'undefined' ? window.location.href : ''),
    extra,
  };
  fetch('/api/errors/log/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(payload),
  }).catch(() => {}); // Silently ignore logging failures
}
