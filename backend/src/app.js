import express from 'express';
import gamesRouter from './routes/gamesRouter.js';
import morgan from 'morgan';
import authRouter from './routes/authRouter.js';

// Global Variables
const app = express();

// Middlewares
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use("/api/games", gamesRouter);
app.use('/api/auth', authRouter);

export default app;
