import { Module } from '@nestjs/common';
import { BrandCatalogueService } from './brand-catalogue.service';
import { BrandMediaService } from './brand-media.service';
import { BrandProfileService } from './brand-profile.service';
import { BrandService } from './brand.service';

@Module({
  providers: [BrandService, BrandProfileService, BrandCatalogueService, BrandMediaService],
  exports: [BrandService, BrandProfileService, BrandCatalogueService, BrandMediaService],
})
export class BrandModule {}
