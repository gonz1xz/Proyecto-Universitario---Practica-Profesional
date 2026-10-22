export async function notificationRequest(token, path = '', options = {}) {
  let response;
  try {
    response = await fetch('/api/notifications' + path, { ...options, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) });
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
