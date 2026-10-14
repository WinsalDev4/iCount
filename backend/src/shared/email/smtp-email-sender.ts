import { Inject, Injectable } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { EmailSender, type EmailMessage } from './email-sender.js';

/** SMTP adapter (nodemailer). In development it talks to Mailpit: http://localhost:8025. */
@Injectable()
export class SmtpEmailSender extends EmailSender {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super();
    this.transporter = nodemailer.createTransport(config.mail.smtpUrl);
    this.from = config.mail.from;
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
