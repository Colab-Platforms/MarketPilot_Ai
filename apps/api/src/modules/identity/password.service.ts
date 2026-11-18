import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  // Verified against when the account does not exist, so response time does not
  // reveal whether an email is registered.
  private decoyHash: Promise<string> | undefined;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(storedHash: string | null, plain: string): Promise<boolean> {
    this.decoyHash ??= argon2.hash('decoy-password-for-timing', { type: argon2.argon2id });
    const target = storedHash ?? (await this.decoyHash);
    const matches = await argon2.verify(target, plain).catch(() => false);
    return storedHash !== null && matches;
  }
}
