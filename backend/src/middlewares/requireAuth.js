import jwt from 'jsonwebtoken';

export const requireAuth = (req, res, next) => {
    const [type, token, extra] = (req.get('Authorization') || '').split(' ');
    if (type !== 'Bearer' || !token || extra) {
        return res.status(401).json({ message: 'Necesitás iniciar sesión' });
    }
    try {
        const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, { algorithms: ['HS256'] });
        if (payload.type !== 'access' || !Number.isInteger(payload.userId) || payload.userId <= 0) {
            throw new Error('Token inválido');
        }
        req.userId = payload.userId;
        next();
    } catch {
        return res.status(401).json({ message: 'Token inválido o vencido' });
    }
};
