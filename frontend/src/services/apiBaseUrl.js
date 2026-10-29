// En Vercel se configura la URL pública de Render, terminada en /api.
// En desarrollo se conserva /api y el proxy de Vite.
export const API_BASE_URL = (import.meta.env?.VITE_API_URL || '/api').replace(/\/+$/, '');
