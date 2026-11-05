import { API_BASE_URL } from './apiBaseUrl.js';
import { authenticatedFetch } from './authSession.js';

export async function notificationRequest(token, path = '', options = {}) {
  let response;
  try {
    response = await authenticatedFetch(API_BASE_URL + '/notifications' + path, { ...options, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) }, token);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error('No pudimos conectarnos al servicio de notificaciones.');
  }
  if (response.status === 204) return;
  let data;
  try { data = await response.json(); }
  catch { throw new Error('El servidor devolvió una respuesta inesperada.'); }
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud.');
  return data;
}
