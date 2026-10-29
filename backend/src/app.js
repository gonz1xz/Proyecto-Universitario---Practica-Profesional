import express from 'express';
import gamesRouter from './routes/gamesRouter.js';
import morgan from 'morgan';
import authRouter from './routes/authRouter.js';
import favoritesRouter from './routes/favoritesRouter.js';
import notificationsRouter from './routes/notificationsRouter.js';
import cors from 'cors';

// Global Variables
const app = express();
// Render coloca un proxy delante de Express. Esto permite identificar la IP del cliente.
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

// Middlewares
app.use(cors({
  origin(origin, callback) {
    const fallback = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173,http://127.0.0.1:5173';
    const allowed = (process.env.CORS_ORIGIN || fallback).split(',').map(value => value.trim().replace(/\/$/, '')).filter(Boolean);
    if (!origin || allowed.includes(origin)) return callback(null, true);
    const error = new Error('Este origen no está permitido para consultar la API.');
    error.code = 'CORS_NOT_ALLOWED';
    callback(error);
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Price-History-Saved'],
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'tiny' : 'dev'));
app.use(express.json());

// Routes
// Comprobar el proceso no requiere despertar ni consultar PostgreSQL.
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use("/api/games", gamesRouter);
app.use('/api/auth', authRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/notifications', notificationsRouter);

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 'CORS_NOT_ALLOWED') return res.status(403).json({ message: error.message });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'El cuerpo de la solicitud no contiene JSON válido.' });
  console.error('No se pudo completar una solicitud por un error interno.');
  res.status(500).json({ message: 'No se pudo completar la solicitud. Intentá nuevamente.' });
});

export default app;
