import { Injectable, Logger } from '@nestjs/common';
import { EmailPort, type OutgoingEmail } from './email.port';

// Development fallback when no provider key is set. Never wired in production.
@Injectable()
export class LogEmailAdapter extends EmailPort {
  private readonly logger = new Logger('Email');

  send(email: OutgoingEmail): Promise<void> {
    this.logger.warn(`No RESEND_API_KEY set; email not sent.\nTo: ${email.to}\n${email.subject}\n${email.text}`);
    return Promise.resolve();
  }
}
