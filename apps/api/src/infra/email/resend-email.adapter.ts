import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config';
import { EmailPort, type OutgoingEmail } from './email.port';

@Injectable()
export class ResendEmailAdapter extends EmailPort {
  private readonly apiKey: string;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    super();
    this.apiKey = config.get('RESEND_API_KEY', { infer: true }) ?? '';
    this.from = config.get('EMAIL_FROM', { infer: true });
  }

  async send(email: OutgoingEmail): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: this.from,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // The error body can echo an email address, so only its short machine-readable name is logged.
      const body = (await response.json().catch(() => null)) as { name?: unknown } | null;
      const name = typeof body?.name === 'string' ? body.name.slice(0, 60) : 'unknown';
      throw new Error(`Resend rejected the email with status ${response.status} (${name})`);
    }
  }
}
