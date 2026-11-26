import { Module } from '@nestjs/common';
import { BrandModule } from '@/modules/brand';
import { AssetFeedbackService } from './asset-feedback.service';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';

@Module({
  imports: [BrandModule],
  controllers: [AssetsController],
  providers: [AssetsService, AssetFeedbackService],
  exports: [AssetsService, AssetFeedbackService],
})
export class AssetsModule {}
