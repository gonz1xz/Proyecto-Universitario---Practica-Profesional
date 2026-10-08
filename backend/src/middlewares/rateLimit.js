import rateLimit from "express-rate-limit";

export const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: "Demasiadas solicitudes, por favor intente más tarde"
});
