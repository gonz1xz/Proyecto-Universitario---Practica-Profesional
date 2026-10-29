import { Router } from 'express';
import prisma from '../prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = Router();
const validGameId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const publicFavorite = favorite => ({ itadGameId: favorite.game.itadGameId, createdAt: favorite.createdAt });

router.use(requireAuth);
router.use(async (req, res, next) => {
  try {
    if (!await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true } })) {
      return res.status(401).json({ message: 'El usuario ya no existe. Iniciá sesión nuevamente.' });
    }
    next();
  } catch { res.status(500).json({ message: 'No se pudo comprobar la sesión.' }); }
});

async function getGameInfo(id) {
  const url = new URL('https://api.isthereanydeal.com/games/info/v2');
  url.searchParams.set('id', id);
  const response = await fetch(url, { headers: { 'ITAD-API-Key': process.env.ITAD_API_KEY }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) { const error = new Error('No se pudo consultar el juego.'); error.status = response.status === 404 ? 404 : 502; throw error; }
  const info = await response.json();
  if (info.id !== id || typeof info.title !== 'string') throw new Error('El juego recibido no es válido.');
  return info;
}

router.get('/', async (req, res) => {
  const includeDetails = req.query.includeDetails === 'true';
  if (req.query.includeDetails !== undefined && !['true', 'false'].includes(req.query.includeDetails)) {
    return res.status(400).json({ message: 'includeDetails debe ser true o false.' });
  }
  const offsetValue = req.query.offset ?? '0';
  const limitValue = req.query.limit ?? '24';
  const offset = Number(offsetValue);
  const limit = Number(limitValue);
  if (typeof offsetValue !== 'string' || !/^\d+$/.test(offsetValue) || !Number.isSafeInteger(offset) ||
      typeof limitValue !== 'string' || !/^\d+$/.test(limitValue) || !Number.isSafeInteger(limit) || limit < 1 || limit > 24) {
    return res.status(400).json({ message: 'La paginación de favoritos no es válida.' });
  }
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.userId }, include: { game: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(includeDetails ? { skip: offset, take: limit } : {}),
    });
    if (!includeDetails) return res.json({ favorites: favorites.map(publicFavorite) });
    // Un fallo de ITAD no oculta los juegos guardados ni impide quitarlos.
    const games = await Promise.all(favorites.map(async favorite => {
      const id = favorite.game.itadGameId;
      try { return { ...await getGameInfo(id), savedAt: favorite.createdAt }; }
      catch { return { id, title: 'Juego guardado', assets: null, detailsUnavailable: true, savedAt: favorite.createdAt }; }
    }));
    const total = await prisma.favorite.count({ where: { userId: req.userId } });
    res.json({ games, total, hasMore: offset + games.length < total, nextOffset: offset + games.length });
  } catch { res.status(500).json({ message: 'No se pudieron cargar los favoritos.' }); }
});

router.post('/', async (req, res) => {
  if (!validGameId(req.body?.itadGameId)) return res.status(400).json({ message: 'El identificador del juego no es válido.' });
  if (!process.env.ITAD_API_KEY) return res.status(503).json({ message: 'Falta configurar la conexión con IsThereAnyDeal.' });
  const itadGameId = req.body.itadGameId.toLowerCase();
  try { await getGameInfo(itadGameId); }
  catch (error) { return res.status(error.status || 502).json({ message: error.status === 404 ? 'No se encontró ese juego.' : 'No se pudo verificar el juego. Intentá nuevamente.' }); }
  try {
    const favorite = await prisma.$transaction(async tx => {
      const game = await tx.game.upsert({ where: { itadGameId }, create: { itadGameId }, update: { itadGameId } });
      return tx.favorite.upsert({
        where: { userId_gameId: { userId: req.userId, gameId: game.id } },
        create: { userId: req.userId, gameId: game.id }, update: { gameId: game.id }, include: { game: true },
      });
    });
    res.json({ favorite: publicFavorite(favorite) });
  } catch { res.status(500).json({ message: 'No se pudo guardar el favorito.' }); }
});

// Eliminar una selección en una transacción y siempre dentro del usuario del JWT.
router.delete('/', async (req, res) => {
  const selected = req.body?.itadGameIds;
  if (!Array.isArray(selected) || selected.length < 1 || selected.length > 100 || !selected.every(validGameId)) {
    return res.status(400).json({ message: 'Seleccioná entre 1 y 100 juegos con identificadores válidos.' });
  }
  const removedIds = [...new Set(selected.map(id => id.toLowerCase()))];
  const where = { userId: req.userId, game: { itadGameId: { in: removedIds } } };
  try {
    const [, result] = await prisma.$transaction([
      prisma.priceAlert.deleteMany({ where }),
      prisma.favorite.deleteMany({ where }),
    ]);
    res.json({ removedIds, removedCount: result.count });
  } catch { res.status(500).json({ message: 'No se pudieron quitar los favoritos seleccionados. Intentá nuevamente.' }); }
});

router.delete('/:itadGameId', async (req, res) => {
  if (!validGameId(req.params.itadGameId)) return res.status(400).json({ message: 'El identificador del juego no es válido.' });
  try {
    const where = { userId: req.userId, game: { itadGameId: req.params.itadGameId.toLowerCase() } };
    await prisma.$transaction([
      prisma.priceAlert.deleteMany({ where }),
      prisma.favorite.deleteMany({ where }),
    ]);
    res.status(204).end();
  } catch { res.status(500).json({ message: 'No se pudo quitar el favorito.' }); }
});

export default router;
