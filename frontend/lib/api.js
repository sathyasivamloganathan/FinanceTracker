// Same-origin by default: the browser talks to /api/* on the frontend's own
// domain and Next.js (next.config.mjs → rewrites) forwards it to the backend.
// That makes the session cookie first-party (works in Safari/iOS, PWAs and
// with third-party cookies blocked) and removes the need for CORS.
// Set NEXT_PUBLIC_API_URL only for a legacy cross-site deployment.
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

const TIMEOUT_MS = 20000;
export const UNAUTHORIZED_EVENT = 'vantage:unauthorized';

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const hasBody = options.body !== undefined;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...options,
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    const err = new Error(e && e.name === 'AbortError'
      ? 'The server took too long to respond. Please try again.'
      : 'Network error — check your connection and try again.');
    err.status = 0;
    throw err;
  } finally {
    clearTimeout(timer);
  }

  let body = null;
  try { body = await res.json(); } catch { /* empty or non-JSON body */ }

  if (!res.ok) {
    const err = new Error((body && body.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = body && body.code;
    // A 401 on a data call means the session ended: tell the app once, globally.
    if (res.status === 401 && !path.startsWith('/api/auth/') && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw err;
  }
  return body;
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  delete: (path, data) => request(path, data === undefined ? { method: 'DELETE' } : { method: 'DELETE', body: JSON.stringify(data) }),
};
