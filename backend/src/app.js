import express from 'express';
import gamesRouter from './routes/gamesRouter.js';
import morgan from 'morgan';

// Global Variables
const app = express();

// Middlewares
app.use(morgan('dev'));
app.use(express.json());

// Routes

// app.use("/", (req, res) => {
//     res.send("Welcome to the AuraPrices API")
// })

app.use("/api/games", gamesRouter);

export default app;