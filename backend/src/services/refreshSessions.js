import { randomBytes, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';

export const REFRESH_COOKIE = 'auraprices_refresh';
export const createRefreshToken = () => randomBytes(32).toString('hex');
export const hashRefreshToken = token => createHash('sha256').update(token).digest('hex');
export const createAccessToken = userId => jwt.sign(
  { userId, type: 'access' }, process.env.ACCESS_TOKEN_SECRET,
  { algorithm: 'HS256', expiresIn: '15m' }
);

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/auth',
  };
}

export function setRefreshCookie(res, token, session) {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieOptions(),
    ...(session.remember ? { expires: session.expiresAt } : {}),
  });
}

export const clearRefreshCookie = res => res.clearCookie(REFRESH_COOKIE, cookieOptions());

// Un formulario de otro sitio no puede agregar este encabezado.
// El navegador exige un preflight y CORS solo permite los orígenes configurados.
export function requireAuthRequest(req, res, next) {
  if (req.get('X-Aura-Request') !== '1') {
    return res.status(403).json({ message: 'La solicitud de sesión no está permitida.' });
  }
  next();
}
