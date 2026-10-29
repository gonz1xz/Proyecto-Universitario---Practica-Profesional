import app from './app.js';
import dotenv from 'dotenv';
import { startPriceNotifications } from './services/priceNotifications.js';

dotenv.config();

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT debe ser un puerto válido entre 1 y 65535.');
}

if (process.env.NODE_ENV === 'production') {
  for (const name of ['DATABASE_URL', 'DIRECT_URL', 'ACCESS_TOKEN_SECRET', 'ITAD_API_KEY', 'CORS_ORIGIN']) {
    if (!process.env[name]?.trim()) throw new Error('Falta configurar la variable ' + name + '.');
  }
  for (const origin of process.env.CORS_ORIGIN.split(',').map(value => value.trim())) {
    let url;
    try { url = new URL(origin); } catch { throw new Error('CORS_ORIGIN debe contener orígenes HTTPS válidos separados por comas.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.origin !== origin.replace(/\/$/, '')) {
      throw new Error('CORS_ORIGIN debe contener solo orígenes HTTPS, sin rutas ni credenciales.');
    }
  }
}

app.listen(port, '0.0.0.0', error => {
  if (error) {
    console.error('No se pudo iniciar el servidor. Comprobá que el puerto esté disponible.');
    process.exitCode = 1;
    return;
  }
  if (process.env.ENABLE_PRICE_CHECKS !== 'false') startPriceNotifications();
  console.log(`Servidor iniciado en el puerto ${port}.`);
});
