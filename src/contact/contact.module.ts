import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller.js';
import { ContactService } from './contact.service.js';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [ContactController],
  providers: [ContactService, OptionalJwtAuthGuard],
  exports: [ContactService],
})
export class ContactModule {}

