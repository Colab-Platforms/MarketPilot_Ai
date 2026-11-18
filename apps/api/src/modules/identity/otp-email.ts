import type { OutgoingEmail } from '@/infra/email';

export function verificationEmail(to: string, name: string, code: string, ttlMinutes: number): OutgoingEmail {
  const subject = `${code} is your MarketPilot verification code`;
  const text = [
    `Hi ${name},`,
    '',
    `Your MarketPilot verification code is ${code}.`,
    `It expires in ${ttlMinutes} minutes. If you did not create an account, ignore this email.`,
  ].join('\n');
  // Email clients ignore stylesheets and design tokens, so styles are inline.
  const html = `<div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#1a1a1a">
<p>Hi ${escapeHtml(name)},</p>
<p>Your MarketPilot verification code is:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0">${code}</p>
<p style="color:#555">It expires in ${ttlMinutes} minutes. If you did not create an account, ignore this email.</p>
</div>`;
  return { to, subject, text, html };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
