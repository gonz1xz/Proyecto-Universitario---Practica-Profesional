import { createHash } from 'node:crypto';

// Brevo necesita una clave UUID estable para reconocer el mismo envío.
export function emailIdempotencyKey(value) {
  const bytes = createHash('sha256').update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function emailSender(from) {
  const match = from?.match(/^(?:([^<>]+)\s*<([^<>]+)>|([^<>\s]+))$/);
  const email = (match?.[2] || match?.[3] || '').trim();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return null;
  return { email, ...(match[1] ? { name: match[1].trim() } : {}) };
}

// Solo estos errores contienen mensajes preparados para mostrar en la interfaz.
export class EmailError extends Error {
  constructor(message, code, status = 502, providerStatus) {
    super(message);
    this.code = code;
    this.status = status;
    this.providerStatus = providerStatus;
  }
}

function providerEmailError(status, data) {
  // Usar el mensaje externo para clasificar, nunca devolverlo ni registrarlo completo.
  const message = typeof data?.message === 'string' ? data.message.toLowerCase() : '';
  const code = typeof data?.code === 'string' ? data.code : '';
  if (message.includes('sender') && /not valid|invalid|not verified|not activated/.test(message)) {
    return new EmailError('El remitente del correo todavía no está habilitado. Verificá su dirección en Brevo.', 'EMAIL_SENDER_UNVERIFIED', 502, status);
  }
  if (status === 429 || code === 'not_enough_credits') {
    return new EmailError('Se alcanzó un límite de envío de correos. Intentá nuevamente más tarde.', 'EMAIL_LIMIT', 429, status);
  }
  if (status === 401 || status === 403 || ['unauthorized', 'permission_denied'].includes(code)) {
    return new EmailError('El servicio de correo no está autorizado para enviar. Revisá la clave API y la habilitación de correos transaccionales en Brevo.', 'EMAIL_AUTH', 503, status);
  }
  return new EmailError('No se pudo enviar el correo. Intentá nuevamente más tarde.', 'EMAIL_PROVIDER', 502, status);
}

// La integración usa fetch, sin un SDK adicional. Nunca enviar esta clave al cliente.
export function emailConfiguration() {
  try {
    const frontend = new URL(process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173'));
    if (!['https:', 'http:'].includes(frontend.protocol) || frontend.username || frontend.password ||
        frontend.search || frontend.hash || frontend.pathname !== '/' ||
        (process.env.NODE_ENV === 'production' && frontend.protocol !== 'https:')) return null;
    const from = process.env.EMAIL_FROM?.trim();
    if (!process.env.BREVO_API_KEY?.trim() || !from || /[\r\n]/.test(from) || !emailSender(from)) return null;
    return { from, frontend: frontend.origin };
  } catch { return null; }
}

export function priceEmail(notification, email) {
  const config = emailConfiguration();
  if (!config) return null;
  return {
    provider: 'brevo', from: config.from, to: [email],
    subject: `Tu alerta de precio: ${notification.gameTitle.replace(/[\r\n]/g, ' ').slice(0, 150)}`,
    text: [
      `¡${notification.gameTitle} alcanzó tu precio objetivo!`,
      `Precio detectado: USD ${Number(notification.price).toFixed(2)}.`,
      `Tienda: ${notification.storeName}.`,
      'Precios de la región US, en USD.',
      `Fecha: ${new Date(notification.createdAt).toLocaleString('es-AR', { timeZone: 'America/Buenos_Aires' })} (hora de Argentina).`,
      'El precio puede cambiar. Confirmá el importe antes de comprar.',
      `Ver tus favoritos: ${config.frontend}/mis-favoritos`,
      `Para dejar de recibir estos avisos, desactivá el mail en la alerta de ese juego desde tus favoritos.`,
    ].join('\n\n'),
  };
}

export async function sendEmail(payload, idempotencyKey) {
  if (!emailConfiguration()) throw new EmailError('El envío por mail todavía no está configurado.', 'EMAIL_CONFIGURATION', 503);
  let response;
  try {
    response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY.trim(),
        'Content-Type': 'application/json', Accept: 'application/json',
      },
      // JSONB puede devolver las claves en otro orden. Mantener el cuerpo estable.
      body: JSON.stringify({ sender: emailSender(payload.from), to: payload.to.map(email => ({ email })), subject: payload.subject, textContent: payload.text, headers: { idempotencyKey: emailIdempotencyKey(idempotencyKey) } }),
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new EmailError('No se pudo conectar con el servicio de correo. Intentá nuevamente.', 'EMAIL_CONNECTION'); }
  if (!response.ok) {
    let data;
    try { data = await response.json(); } catch { data = null; }
    // Brevo ya aceptó esta clave. No devuelve el ID original al rechazar el duplicado.
    if (data?.code === 'duplicate_parameter' && /idempotency/i.test(data?.message || '')) return null;
    throw providerEmailError(response.status, data);
  }
  let data;
  try { data = await response.json(); }
  catch { throw new EmailError('El servicio de correo devolvió una respuesta inesperada.', 'EMAIL_RESPONSE'); }
  if (typeof data?.messageId !== 'string' || !data.messageId) throw new EmailError('El servicio de correo no confirmó el envío.', 'EMAIL_RESPONSE');
  return data.messageId;
}
