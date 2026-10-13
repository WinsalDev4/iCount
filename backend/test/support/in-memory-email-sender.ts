import { type EmailMessage, EmailSender } from '../../src/shared/email/email-sender.js';

/** Captures emails instead of sending them, so e2e tests can follow magic links. */
export class InMemoryEmailSender extends EmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }

  /** Token of the last magic link sent to `email` (what the app gets from the deep link). */
  lastMagicLinkToken(email: string): string {
    const message = this.sent.findLast((m) => m.to === email);
    const token = message && /[?&]token=([^\s"&]+)/.exec(message.text)?.[1];
    if (!token) throw new Error(`No magic link was sent to ${email}`);
    return decodeURIComponent(token);
  }

  clear(): void {
    this.sent.length = 0;
  }
}
