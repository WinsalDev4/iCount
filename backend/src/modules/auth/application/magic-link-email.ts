import type { EmailMessage } from '../../../shared/email/email-sender.js';

/** The sign-in email (Spanish, plain text + minimal HTML that every client renders). */
export function magicLinkEmail(to: string, link: string, ttlMinutes: number): EmailMessage {
  const text = [
    'Hola:',
    '',
    `Toca este enlace desde tu móvil para entrar en iCount. Caduca en ${ttlMinutes} minutos y solo sirve una vez:`,
    '',
    link,
    '',
    'Si no lo has pedido tú, ignora este correo: nadie puede entrar sin él.',
  ].join('\n');

  const html = `<p>Hola:</p>
<p>Toca el botón desde tu móvil para entrar en iCount. Caduca en ${ttlMinutes} minutos y solo sirve una vez.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#8C7BFF;color:#0B0C1A;text-decoration:none;font-weight:600">Entrar en iCount</a></p>
<p style="color:#666">Si no lo has pedido tú, ignora este correo: nadie puede entrar sin él.</p>`;

  return { to, subject: 'Tu enlace para entrar en iCount', text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
