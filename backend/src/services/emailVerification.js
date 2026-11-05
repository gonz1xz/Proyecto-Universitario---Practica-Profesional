import { randomBytes, createHash } from 'node:crypto';
import prisma from '../prisma.js';
import { emailConfiguration, sendEmail } from './email.js';

export const hashEmailToken = token => createHash('sha256').update(token).digest('hex');

export async function requestEmailVerification(userId) {
  const config = emailConfiguration();
  if (!config) throw new Error('El envío por mail todavía no está configurado.');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user.emailVerifiedAt) return;
  const token = randomBytes(32).toString('hex');
  const hash = hashEmailToken(token);
  await prisma.user.update({ where: { id: userId }, data: {
    emailVerificationHash: hash, emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  } });
  try {
    await sendEmail({
      from: config.from, to: [user.email], subject: 'Confirmá tu correo para las alertas de AuraPrices',
      text: `Para recibir avisos de precio, abrí este enlace y confirmá tu correo:\n\n${config.frontend}/notificaciones/verificar-email#token=${token}\n\nEl enlace vence en 24 horas y solo se puede usar una vez. Si no lo solicitaste, podés ignorarlo.`,
    }, `verify-email/${hash}`);
  } catch (error) {
    try {
      await prisma.user.updateMany({ where: { id: userId, emailVerificationHash: hash }, data: {
        emailVerificationHash: null, emailVerificationExpiresAt: null,
      } });
    } catch { console.error('No se pudo descartar una confirmación de correo fallida.'); }
    throw error;
  }
}

export async function verifyEmail(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return false;
  const result = await prisma.user.updateMany({ where: {
    emailVerificationHash: hashEmailToken(token), emailVerificationExpiresAt: { gt: new Date() },
  }, data: { emailVerifiedAt: new Date(), emailVerificationHash: null, emailVerificationExpiresAt: null } });
  return result.count === 1;
}
