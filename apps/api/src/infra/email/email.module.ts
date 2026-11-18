import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config';
import { EmailPort } from './email.port';
import { LogEmailAdapter } from './log-email.adapter';
import { ResendEmailAdapter } from './resend-email.adapter';

@Global()
@Module({
  providers: [
    {
      provide: EmailPort,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): EmailPort => {
        if (config.get('RESEND_API_KEY', { infer: true })) return new ResendEmailAdapter(config);
        if (config.get('NODE_ENV', { infer: true }) === 'production') {
          throw new Error('RESEND_API_KEY is required in production');
        }
        return new LogEmailAdapter();
      },
    },
  ],
  exports: [EmailPort],
})
export class EmailModule {}
