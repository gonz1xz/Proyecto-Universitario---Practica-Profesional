import express from "express";
import bcrypt from "bcrypt";
import prisma from "../prisma.js";
import "dotenv/config";
import { sanitizeInput } from "../middlewares/sanitazeInput.js";
import { checkCredentials, checkUsername, validateUserCredentials } from "../middlewares/checkCredentials.js";
import { limiter } from "../middlewares/rateLimit.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { verifyEmail } from '../services/emailVerification.js';
import { REFRESH_COOKIE, createRefreshToken, hashRefreshToken, createAccessToken,
    setRefreshCookie, clearRefreshCookie, requireAuthRequest } from '../services/refreshSessions.js';

const router = express.Router();

const publicUser = (user) => ({
    id: user.id,
    email: user.email,
    username: user.username
});

router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!process.env.ACCESS_TOKEN_SECRET) {
        return res.status(503).json({ message: "Falta configurar ACCESS_TOKEN_SECRET" });
    }
    next();
});

router.post("/register", limiter, sanitizeInput, checkCredentials, checkUsername, validateUserCredentials, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ message: "El usuario ya existe" });
        }

        // bcrypt genera la sal y el hash en una sola llamada.
        const passwordHash = await bcrypt.hash(password, 10);

        // PostgreSQL genera el ID y createdAt; password guarda el hash.
        const user = await prisma.user.create({
            data: { username, email, password: passwordHash }
        });

        res.status(201).json({ message: "Usuario creado correctamente", user: publicUser(user) });
    } catch (error) {
        // La restricción única cubre también registros simultáneos.
        if (error.code === "P2002") {
            return res.status(409).json({ message: "El usuario ya existe" });
        }
        res.status(500).json({ message: "No se pudo crear el usuario" });
    }
});

router.post("/login", requireAuthRequest, limiter, sanitizeInput, checkCredentials, validateUserCredentials, async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(401).json({ message: "Correo o contraseña incorrectos" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: "Correo o contraseña incorrectos" });
        }

        const remember = req.body.remember === true;
        const refreshToken = createRefreshToken();
        const previousToken = req.cookies[REFRESH_COOKIE];
        const session = await prisma.$transaction(async tx => {
            // Limpiar sesiones vencidas y reemplazar la de este navegador.
            await tx.refreshSession.deleteMany({ where: { OR: [
                { expiresAt: { lte: new Date() } },
                ...(previousToken ? [{ tokenHash: hashRefreshToken(previousToken) }] : [])
            ] } });
            return tx.refreshSession.create({ data: {
                userId: user.id, tokenHash: hashRefreshToken(refreshToken), remember,
                expiresAt: new Date(Date.now() + (remember ? 30 : 1) * 24 * 60 * 60 * 1000)
            } });
        });
        const accessToken = createAccessToken(user.id);
        setRefreshCookie(res, refreshToken, session);

        res.json({ user: publicUser(user), accessToken });
    } catch {
        res.status(500).json({ message: "No se pudo iniciar sesión" });
    }
});

router.post('/refresh', requireAuthRequest, async (req, res) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        clearRefreshCookie(res);
        return res.status(401).json({ message: 'Tu sesión venció. Iniciá sesión nuevamente.' });
    }
    try {
        const tokenHash = hashRefreshToken(token);
        const nextToken = createRefreshToken();
        const session = await prisma.$transaction(async tx => {
            const current = await tx.refreshSession.findUnique({ where: { tokenHash }, include: { user: true } });
            if (!current || current.expiresAt <= new Date()) return null;
            // La condición sobre el hash permite que solo una petición lo use.
            const result = await tx.refreshSession.updateMany({
                where: { id: current.id, tokenHash, expiresAt: { gt: new Date() } },
                data: { tokenHash: hashRefreshToken(nextToken) }
            });
            return result.count === 1 ? current : null;
        });
        if (!session) {
            // No borrar la cookie: otra pestaña puede haber renovado primero.
            return res.status(401).json({ message: 'Tu sesión venció. Iniciá sesión nuevamente.' });
        }
        setRefreshCookie(res, nextToken, session);
        res.json({ user: publicUser(session.user), accessToken: createAccessToken(session.userId) });
    } catch {
        res.status(500).json({ message: 'No se pudo renovar la sesión. Intentá nuevamente.' });
    }
});

router.post('/logout', requireAuthRequest, async (req, res) => {
    try {
        const token = req.cookies[REFRESH_COOKIE];
        if (token) await prisma.refreshSession.deleteMany({ where: { tokenHash: hashRefreshToken(token) } });
        clearRefreshCookie(res);
        res.sendStatus(204);
    } catch {
        res.status(500).json({ message: 'No se pudo cerrar la sesión. Intentá nuevamente.' });
    }
});

router.get("/me", requireAuth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!user) {
            return res.status(401).json({ message: "El usuario ya no existe" });
        }
        res.json({ user: publicUser(user) });
    } catch {
        res.status(500).json({ message: "No se pudo consultar el usuario" });
    }
});

router.post('/verify-email', requireAuthRequest, limiter, async (req, res) => {
    try {
        if (!await verifyEmail(req.body?.token)) return res.status(400).json({ message: 'El enlace venció o ya fue utilizado. Solicitá uno nuevo desde tu alerta.' });
        res.json({ message: 'Correo confirmado. Ya podés activar los avisos por mail en tus alertas.' });
    } catch { res.status(500).json({ message: 'No se pudo confirmar el correo. Intentá nuevamente.' }); }
});

export default router;

