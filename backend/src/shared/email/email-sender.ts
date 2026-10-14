export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** Port for transactional email. SMTP (Mailpit in development) today; a provider API in production. */
export abstract class EmailSender {
  abstract send(message: EmailMessage): Promise<void>;
}
