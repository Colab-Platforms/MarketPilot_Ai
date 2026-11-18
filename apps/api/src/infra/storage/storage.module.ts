import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config';
import { CloudinaryAdapter } from './cloudinary.adapter';
import { MediaStoragePort } from './media-storage.port';
import { UnavailableMediaStorage } from './unavailable-media-storage.adapter';

@Global()
@Module({
  providers: [
    {
      provide: MediaStoragePort,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): MediaStoragePort => {
        const url = config.get('CLOUDINARY_URL', { infer: true });
        return url ? new CloudinaryAdapter(url) : new UnavailableMediaStorage();
      },
    },
  ],
  exports: [MediaStoragePort],
})
export class StorageModule {}
