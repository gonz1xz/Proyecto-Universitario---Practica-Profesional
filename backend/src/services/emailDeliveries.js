import prisma from '../prisma.js';
import { emailConfiguration, priceEmail, sendEmail } from './email.js';

let running = false;
export async function deliverPendingEmails() {
  if (running || !emailConfiguration()) return;
  running = true;
  try {
    const now = new Date();
    // Si un proceso se detuvo después de reclamar un envío, otro puede recuperarlo.
    const stale = new Date(now.getTime() - 2 * 60 * 1000);
    await prisma.notification.updateMany({
      where: { emailStatus: 'sending', emailClaimedAt: { lt: stale } },
      data: { emailStatus: 'pending' },
    });
    const notifications = await prisma.notification.findMany({
      where: { emailStatus: 'pending', OR: [{ emailNextAttemptAt: null }, { emailNextAttemptAt: { lte: now } }] },
      orderBy: { id: 'asc' }, take: 20, include: { user: { select: { email: true, emailVerifiedAt: true } } },
    });
    for (const notification of notifications) {
      const startedAt = Date.parse(notification.emailPayload?.deliveryStartedAt);
      // Usar 25 minutos deja margen antes del vencimiento de Brevo (30 minutos).
      // No reenviar trabajos ya intentados con el proveedor anterior o sin fecha persistida.
      const unsafeRetry = notification.emailAttempts > 0 && (
        notification.emailPayload?.provider !== 'brevo' || !Number.isFinite(startedAt) ||
        now.getTime() - startedAt >= 25 * 60 * 1000
      );
      if (notification.emailAttempts >= 5 || unsafeRetry || now.getTime() - notification.createdAt.getTime() >= 24 * 60 * 60 * 1000) {
        await prisma.notification.updateMany({ where: { id: notification.id, emailStatus: 'pending' }, data: { emailStatus: 'failed' } });
        continue;
      }
      const alert = await prisma.priceAlert.findFirst({ where: {
        userId: notification.userId, game: { itadGameId: notification.itadGameId },
        isActive: true, emailEnabled: true, currency: 'USD', targetPrice: { gte: notification.price },
      } });
      const favorite = alert && await prisma.favorite.findUnique({ where: { userId_gameId: { userId: notification.userId, gameId: alert.gameId } } });
      if (!notification.user.emailVerifiedAt || !favorite) {
        await prisma.notification.updateMany({ where: { id: notification.id, emailStatus: 'pending' }, data: { emailStatus: 'cancelled' } });
        continue;
      }
      // Guardar el contenido conserva exactamente el mismo envío en cada reintento.
      const claimedAt = new Date();
      const payload = notification.emailAttempts > 0 ? notification.emailPayload : {
        ...priceEmail(notification, notification.user.email), deliveryStartedAt: claimedAt.toISOString(),
      };
      if (!payload) continue;
      const claimed = await prisma.notification.updateMany({
        where: { id: notification.id, emailStatus: 'pending', emailAttempts: notification.emailAttempts },
        data: { emailStatus: 'sending', emailPayload: payload, emailClaimedAt: claimedAt, emailAttempts: { increment: 1 } },
      });
      if (!claimed.count) continue;
      try {
        const providerId = await sendEmail(payload, `price-alert/${notification.id}`);
        await prisma.notification.updateMany({
          where: { id: notification.id, emailStatus: 'sending', emailClaimedAt: claimedAt },
          data: { emailStatus: 'sent', emailSentAt: new Date(), emailProviderId: providerId },
        });
      } catch {
        await prisma.notification.updateMany({
          where: { id: notification.id, emailStatus: 'sending', emailClaimedAt: claimedAt },
          data: {
            emailStatus: notification.emailAttempts + 1 >= 5 ? 'failed' : 'pending',
            emailNextAttemptAt: new Date(Date.now() + Math.min(2 ** notification.emailAttempts, 15) * 60 * 1000),
          },
        });
        console.error('No se pudo enviar un aviso por mail. El buzón interno conserva la notificación.');
      }
    }
  } finally { running = false; }
}

export function startEmailDeliveries() {
  const run = () => deliverPendingEmails().catch(() => console.error('No se pudieron procesar los avisos por mail. Se reintentará más tarde.'));
  void run();
  const timer = setInterval(run, 60_000);
  timer.unref();
  return timer;
}
