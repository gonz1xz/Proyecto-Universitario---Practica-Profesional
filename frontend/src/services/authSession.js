import { loginUser, refreshUser, logoutUser } from './authApi.js';

let session = null;
let pendingRefresh = null;
let version = 0;
let closing = false;
const listeners = new Set();

export const getSession = () => session;
export function subscribeSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(value) {
  session = value ? { user: value.user, token: value.accessToken } : null;
  listeners.forEach(listener => listener(session));
}

// Serializar el uso de la cookie también entre pestañas cuando Web Locks existe.
function withSessionLock(action) {
  return globalThis.navigator?.locks
    ? navigator.locks.request('auraprices-session', action)
    : action();
}

export function expirationTime(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')));
    return Number.isFinite(payload.exp) ? payload.exp * 1000 : 0;
  } catch { return 0; }
}

export function renewSession() {
  if (closing) return Promise.reject(new Error('La sesión se está cerrando.'));
  if (pendingRefresh) return pendingRefresh;
  const startedVersion = version;
  pendingRefresh = withSessionLock(() => refreshUser())
    .then(data => {
      if (startedVersion === version) publish(data);
      return session;
    })
    .catch(error => {
      // Un corte de red no elimina la sesión: se puede reintentar.
      if (error.status === 401 && startedVersion === version && session) publish(null);
      throw error;
    })
    .finally(() => { pendingRefresh = null; });
  return pendingRefresh;
}

export async function startSession(form, remember) {
  const startedVersion = ++version;
  await pendingRefresh?.catch(() => {});
  const data = await withSessionLock(() => loginUser({ ...form, remember }));
  if (startedVersion === version) publish(data);
}

export async function endSession() {
  closing = true;
  ++version;
  try {
    await pendingRefresh?.catch(() => {});
    await withSessionLock(() => logoutUser());
    publish(null);
  } finally { closing = false; }
}

export async function authenticatedFetch(url, options, fallbackToken) {
  let token = session?.token || fallbackToken;
  if (session && expirationTime(token) <= Date.now() + 30_000) {
    token = (await renewSession())?.token;
  }
  const send = accessToken => fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: 'Bearer ' + accessToken },
  });
  let response = await send(token);
  if (response.status === 401 && !options.signal?.aborted && !closing) {
    const renewed = session?.token && session.token !== token ? session : await renewSession();
    if (renewed) response = await send(renewed.token);
  }
  return response;
}
