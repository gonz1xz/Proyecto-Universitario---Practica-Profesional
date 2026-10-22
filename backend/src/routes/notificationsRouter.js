import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = Router();
router.use(requireAuth);
router.use(async (req, res, next) => {
  try {
    if (!await prisma.user.findUnique({ where: { id: req.userId } })) return res.status(401).json({ message: 'El usuario ya no existe.' });
    next();
  } catch { res.status(500).json({ message: 'No se pudo comprobar la sesión.' }); }
});

router.get('/alerts/:itadGameId', async (req, res) => {
  try {
    const alert = await prisma.priceAlert.findFirst({ where: { userId: req.userId, game: { itadGameId: req.params.itadGameId } } });
    res.json({ alert });
  } catch { res.status(500).json({ message: 'No se pudo cargar la alerta.' }); }
});

router.put('/alerts/:itadGameId', async (req, res) => {
  const { targetPrice, isActive } = req.body || {};
  if (typeof targetPrice !== 'number' || !Number.isFinite(targetPrice) || targetPrice < 0 || targetPrice > 9999999999.99 || Math.abs(targetPrice * 100 - Math.round(targetPrice * 100)) > 0.0001 || typeof isActive !== 'boolean') {
    return res.status(400).json({ message: 'Ingresá un precio válido en USD, con hasta dos decimales.' });
  }
  try {
    const alert = await prisma.$transaction(async tx => {
      const favorite = await tx.favorite.findFirst({ where: { userId: req.userId, game: { itadGameId: req.params.itadGameId } } });
      if (!favorite) return null;
      const key = { userId: req.userId, gameId: favorite.gameId };
      const previous = await tx.priceAlert.findUnique({ where: { userId_gameId: key } });
      const data = { targetPrice, isActive, currency: 'USD' };
      const reset = !previous || Number(previous.targetPrice) !== targetPrice || previous.isActive !== isActive;
      return tx.priceAlert.upsert({ where: { userId_gameId: key }, create: { ...key, ...data }, update: { ...data, ...(reset ? { notified: false } : {}) } });
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
    res.json({ notifications, unreadCount });
  } catch { res.status(500).json({ message: 'No se pudieron cargar las notificaciones.' }); }
});

router.patch('/read', async (req, res) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.userId, readAt: null }, data: { readAt: new Date() } });
    res.status(204).end();
  } catch { res.status(500).json({ message: 'No se pudieron marcar las notificaciones.' }); }
});
export default router;
