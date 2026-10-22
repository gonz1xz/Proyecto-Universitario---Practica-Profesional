import express from 'express';
import gamesRouter from './routes/gamesRouter.js';
import morgan from 'morgan';
import authRouter from './routes/authRouter.js';
import favoritesRouter from './routes/favoritesRouter.js';
import notificationsRouter from './routes/notificationsRouter.js';

// Global Variables
const app = express();

// Middlewares
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use("/api/games", gamesRouter);
app.use('/api/auth', authRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/notifications', notificationsRouter);

export default app;
