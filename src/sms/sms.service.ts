import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async sendOtp(phone: string, code: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMS provider is not configured');
    }
    // TODO: replace with the real provider when the SMS panel is ready
    this.logger.warn(`[DEV] OTP for ${phone}: ${code}`);
  }
}
