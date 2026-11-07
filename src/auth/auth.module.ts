import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SmsModule } from '../sms/sms.module.js';

@Module({
  imports: [SmsModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}

