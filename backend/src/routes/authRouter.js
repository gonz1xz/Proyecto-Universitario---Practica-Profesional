import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../prisma.js";
import "dotenv/config";
import { sanitizeInput } from "../middlewares/sanitazeInput.js";
import { checkCredentials, checkUsername, validateUserCredentials } from "../middlewares/checkCredentials.js";
import { limiter } from "../middlewares/rateLimit.js";
import { requireAuth } from "../middlewares/requireAuth.js";

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

router.post("/login", limiter, sanitizeInput, checkCredentials, validateUserCredentials, async (req, res) => {
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

        // El cliente envía este JWT en las siguientes solicitudes.
        const accessToken = jwt.sign(
            { userId: user.id, type: "access" },
            process.env.ACCESS_TOKEN_SECRET,
            { algorithm: "HS256", expiresIn: "15m" }
        );

        res.json({ user: publicUser(user), accessToken });
    } catch {
        res.status(500).json({ message: "No se pudo iniciar sesión" });
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

export default router;

