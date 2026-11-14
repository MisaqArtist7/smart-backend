import { Module } from '@nestjs/common';
import { UploadService } from './upload.service.js';
import { AdminUploadController } from './admin-upload.controller.js';

@Module({
  controllers: [AdminUploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}

