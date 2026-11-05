import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import rateLimit from 'express-rate-limit';
import { EmailError, emailConfiguration } from '../services/email.js';
import { requestEmailVerification } from '../services/emailVerification.js';

const router = Router();
router.use(requireAuth);
router.use(async (req, res, next) => {
  try {
    if (!await prisma.user.findUnique({ where: { id: req.userId } })) return res.status(401).json({ message: 'El usuario ya no existe.' });
    next();
  } catch { res.status(500).json({ message: 'No se pudo comprobar la sesión.' }); }
});

router.get('/email/status', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true, emailVerifiedAt: true } });
    res.json({ email: user.email, verified: Boolean(user.emailVerifiedAt), configured: Boolean(emailConfiguration()) });
  } catch { res.status(500).json({ message: 'No se pudo consultar el estado de tu correo.' }); }
});

const verificationLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5,
  message: { message: 'Solicitaste varios correos. Esperá unos minutos antes de intentar otra vez.' } });
router.post('/email/verification', verificationLimiter, async (req, res) => {
  if (!emailConfiguration()) return res.status(503).json({ message: 'Los avisos por mail todavía no están disponibles.' });
  try {
    await requestEmailVerification(req.userId);
    res.json({ message: 'Revisá tu correo y confirmá el enlace. También podés revisar la carpeta de spam.' });
  } catch (error) {
    if (error instanceof EmailError) {
      console.error(`No se pudo enviar la confirmación. Código: ${error.code}. Estado del proveedor: ${error.providerStatus || 'sin respuesta'}.`);
      return res.status(error.status).json({ message: error.message });
    }
    const code = /^P\d{4}$/.test(error?.code) ? error.code : 'UNKNOWN';
    console.error(`No se pudo preparar la confirmación de correo. Código: ${code}.`);
    res.status(500).json({ message: 'No se pudo preparar la confirmación del correo en el servidor. Intentá nuevamente.' });
  }
});

router.get('/alerts/:itadGameId', async (req, res) => {
  try {
    const alert = await prisma.priceAlert.findFirst({ where: { userId: req.userId, game: { itadGameId: req.params.itadGameId } } });
    res.json({ alert });
  } catch { res.status(500).json({ message: 'No se pudo cargar la alerta.' }); }
});

router.put('/alerts/:itadGameId', async (req, res) => {
  const { targetPrice, isActive, emailEnabled } = req.body || {};
  if (emailEnabled !== undefined && typeof emailEnabled !== 'boolean') return res.status(400).json({ message: 'La opción de aviso por mail no es válida.' });
  if (typeof targetPrice !== 'number' || !Number.isFinite(targetPrice) || targetPrice < 0 || targetPrice > 9999999999.99 || Math.abs(targetPrice * 100 - Math.round(targetPrice * 100)) > 0.0001 || typeof isActive !== 'boolean') {
    return res.status(400).json({ message: 'Ingresá un precio válido en USD, con hasta dos decimales.' });
  }
  try {
    if (emailEnabled === true) {
      const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { emailVerifiedAt: true } });
      if (!user.emailVerifiedAt) return res.status(400).json({ message: 'Primero confirmá tu correo para activar los avisos por mail.' });
    }
    const alert = await prisma.$transaction(async tx => {
      const favorite = await tx.favorite.findFirst({ where: { userId: req.userId, game: { itadGameId: req.params.itadGameId } } });
      if (!favorite) return null;
      const key = { userId: req.userId, gameId: favorite.gameId };
      const previous = await tx.priceAlert.findUnique({ where: { userId_gameId: key } });
      const data = { targetPrice, isActive, currency: 'USD', ...(emailEnabled !== undefined ? { emailEnabled } : {}) };
      const reset = !previous || Number(previous.targetPrice) !== targetPrice || previous.isActive !== isActive;
      const saved = await tx.priceAlert.upsert({ where: { userId_gameId: key }, create: { ...key, ...data }, update: { ...data, ...(reset ? { notified: false } : {}) } });
      if (!isActive || emailEnabled === false) await tx.notification.updateMany({
        where: { userId: req.userId, itadGameId: req.params.itadGameId, emailStatus: 'pending' }, data: { emailStatus: 'cancelled' },
      });
      return saved;
    });
    if (!alert) return res.status(404).json({ message: 'Primero agregá este juego a tus favoritos.' });
    res.json({ alert });
  } catch { res.status(500).json({ message: 'No se pudo guardar la alerta.' }); }
});

router.get('/', async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where: { userId: req.userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...(req.query.all === 'true' ? {} : { take: 50 }) }),
      prisma.notification.count({ where: { userId: req.userId, readAt: null } }),
    ]);
    res.json({ notifications: notifications.map(item => ({
      id: item.id, itadGameId: item.itadGameId, gameTitle: item.gameTitle, type: item.type,
      price: item.price, currency: item.currency, storeName: item.storeName,
      createdAt: item.createdAt, readAt: item.readAt, emailStatus: item.emailStatus,
    })), unreadCount });
  } catch { res.status(500).json({ message: 'No se pudieron cargar las notificaciones.' }); }
});

router.patch('/read', async (req, res) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.userId, readAt: null }, data: { readAt: new Date() } });
    res.status(204).end();
  } catch { res.status(500).json({ message: 'No se pudieron marcar las notificaciones.' }); }
});
export default router;
