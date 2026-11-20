import {
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GHASEDAK_OTP_URL =
  'https://gateway.ghasedak.me/rest/api/v1/webservice/sendotpsms';

interface GhasedakOtpResponse {
  isSuccess?: boolean;
  statusCode?: number;
  message?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(@Optional() private readonly configService?: ConfigService) {}

  private getEnv(key: string): string | undefined {
    return this.configService?.get<string>(key) ?? process.env[key];
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    const apiKey = this.getEnv('GHASEDAK_API_KEY')?.trim();
    const templateName = this.getEnv('GHASEDAK_OTP_TEMPLATE')?.trim();
    const paramName = this.getEnv('GHASEDAK_OTP_PARAM')?.trim() || 'Code';

    if (!apiKey || !templateName) {
      if (this.getEnv('NODE_ENV') === 'production') {
        throw new ServiceUnavailableException(
          'سرویس ارسال پیامک پیکربندی نشده است',
        );
      }
      this.logger.warn(
        '[DEV] GHASEDAK_API_KEY or GHASEDAK_OTP_TEMPLATE is not set; skipping real SMS send.',
      );
      return;
    }

    const payload = {
      sendDate: new Date().toISOString(),
      receptors: [
        {
          mobile: phone,
          clientReferenceId: '',
        },
      ],
      templateName,
      inputs: [
        {
          param: paramName,
          value: code,
        },
      ],
    };

    try {
      const response = await fetch(GHASEDAK_OTP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ApiKey: apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      let body: GhasedakOtpResponse | null = null;
      try {
        body = (await response.json()) as GhasedakOtpResponse;
      } catch {
        // Non-JSON response
      }

      if (!response.ok || body?.isSuccess === false) {
        this.logger.error(
          `Ghasedak OTP send failed with status=${response.status} apiStatus=${body?.statusCode ?? 'unknown'}`,
        );
        throw new ServiceUnavailableException(
          'ارسال پیامک کد تایید با خطا مواجه شد. لطفاً لحظاتی دیگر تلاش کنید',
        );
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error('Ghasedak OTP request failed due to network/timeout error');
      throw new ServiceUnavailableException(
        'امکان ارتباط با سرویس پیامک وجود ندارد. لطفاً لحظاتی دیگر تلاش کنید',
      );
    }
  }
}
