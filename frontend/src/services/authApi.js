const AUTH_ENDPOINT = '/api/auth';

async function request(path, { body, token } = {}) {
  let response;
  try {
    response = await fetch(`${AUTH_ENDPOINT}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error('No pudimos conectarnos con el servidor. Intentá nuevamente.');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const error = new Error(response.status === 429
      ? 'Demasiadas solicitudes. Intentá más tarde.'
      : 'El servidor devolvió una respuesta inesperada. Intentá nuevamente.');
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(data.message || (typeof data === 'string' ? data : 'No se pudo completar la solicitud.'));
    error.status = response.status;
    error.fields = Object.fromEntries((data.errors || []).map(({ path, message }) => [path, message]));
    throw error;
  }
  return data;
}

export const registerUser = (form) => request('/register', { body: form });
export const loginUser = (form) => request('/login', { body: form });
export const getCurrentUser = (token) => request('/me', { token });

export function validateCredentials(form, isRegister = false) {
  const errors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.email.trim().length > 254) {
    errors.email = 'Ingresá un correo válido.';
  }
  if (form.password.length < 6) errors.password = 'Usá al menos 6 caracteres.';
  if (new TextEncoder().encode(form.password).length > 72) errors.password = 'La contraseña no debe superar los 72 bytes.';
  if (isRegister && (form.username.trim().length < 2 || form.username.trim().length > 50)) {
    errors.username = 'El nombre de usuario debe tener entre 2 y 50 caracteres.';
  }
  return errors;
}
