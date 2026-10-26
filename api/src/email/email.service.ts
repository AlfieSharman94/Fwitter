import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export type EmailMessage = { to: string; subject: string; text: string; html: string };

// Transactional email through SES. Disabled (messages are logged, not sent) until EMAIL_FROM
// names a verified SES identity, so local development and a fresh deploy keep working.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly ses: SESClient;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.get<string>('EMAIL_FROM') ?? '';
    // Credentials come from the standard AWS env vars / instance role, like S3.
    this.ses = new SESClient({ region: config.get<string>('AWS_REGION') ?? 'eu-north-1' });
    if (!this.from) this.logger.warn('EMAIL_FROM not set: emails are logged instead of sent');
  }

  get enabled() {
    return !!this.from;
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(`[email not sent] to=${message.to} subject=${message.subject}\n${message.text}`);
      return;
    }
    await this.ses.send(
      new SendEmailCommand({
        Source: this.from,
        Destination: { ToAddresses: [message.to] },
        Message: {
          Subject: { Data: message.subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: message.text, Charset: 'UTF-8' },
            Html: { Data: message.html, Charset: 'UTF-8' },
          },
        },
      }),
    );
  }
}
