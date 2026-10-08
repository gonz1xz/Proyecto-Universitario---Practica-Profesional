import { body, validationResult } from "express-validator";

export const checkCredentials = [
    body("email").isString().withMessage("El correo electrónico debe ser un texto").bail()
        .isLength({ max: 254 }).withMessage("El correo electrónico no debe superar los 254 caracteres").bail()
        .isEmail().withMessage("El correo electrónico no es válido"),
    body("password").isString().withMessage("La contraseña debe ser un texto").bail()
        .isLength({ min: 6 }).withMessage("La contraseña debe tener al menos 6 caracteres").bail()
        // bcrypt procesa hasta 72 bytes; los caracteres con tilde pueden ocupar más de uno.
        .custom(password => Buffer.byteLength(password, 'utf8') <= 72)
        .withMessage("La contraseña no debe superar los 72 bytes"),
];

// El nombre de usuario solo se pide al registrar, no al iniciar sesión.
export const checkUsername = body("username")
    .isString().withMessage("El nombre de usuario debe ser un texto").bail()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage("El nombre de usuario debe tener entre 2 y 50 caracteres");

export const validateUserCredentials = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array().map(({ path, msg }) => ({ path, message: msg })) });
    }
    next();
};
