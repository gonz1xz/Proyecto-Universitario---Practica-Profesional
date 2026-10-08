import sanitizeHtml from 'sanitize-html';

export const sanitizeInput = (req, res, next) => {
    if (req.body) {
        for (const key in req.body) {
            if (key !== 'password' && typeof req.body[key] === 'string') {
                req.body[key] = sanitizeHtml(req.body[key], { allowedTags: [], allowedAttributes: {} });
            }
        }
    }
    if (typeof req.body?.email === 'string') {
        req.body.email = req.body.email.trim().toLowerCase();
    }
    next();
};
