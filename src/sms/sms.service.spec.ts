import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { SmsService } from './sms.service.js';

describe('SmsService (Ghasedak)', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  it('1. ارسال موفق OTP از طریق وب‌سرویس قاصدک (SendOtpSMS)', async () => {
    process.env.GHASEDAK_API_KEY = 'test-api-key';
    process.env.GHASEDAK_OTP_TEMPLATE = 'smart-otp';
    process.env.GHASEDAK_OTP_PARAM = 'Code';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ isSuccess: true, statusCode: 200 }),
    });
    globalThis.fetch = fetchMock as any;

    const service = new SmsService();
    await service.sendOtp('09123456789', '12345');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://gateway.ghasedak.me/rest/api/v1/webservice/sendotpsms',
    );
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      ApiKey: 'test-api-key',
    });

    const parsedBody = JSON.parse(init.body);
    expect(parsedBody.templateName).toBe('smart-otp');
    expect(parsedBody.receptors[0].mobile).toBe('09123456789');
    expect(parsedBody.inputs).toEqual([{ param: 'Code', value: '12345' }]);
  });

  it('2. در صورت خطای HTTP یا isSuccess: false از قاصدک باید ServiceUnavailableException بدهد', async () => {
    process.env.GHASEDAK_API_KEY = 'test-api-key';
    process.env.GHASEDAK_OTP_TEMPLATE = 'smart-otp';

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ isSuccess: false, statusCode: 400, message: 'Bad template' }),
    }) as any;

    const service = new SmsService();
    await expect(service.sendOtp('09123456789', '12345')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('3. در حالت پروداکشن بدون تنظیم کلید یا نام قالب باید خطا بدهد', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GHASEDAK_API_KEY;
    delete process.env.GHASEDAK_OTP_TEMPLATE;

    const service = new SmsService();
    await expect(service.sendOtp('09123456789', '12345')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('4. در حالت توسعه بدون تنظیم قالب بدون خطا عبور می‌کند', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.GHASEDAK_OTP_TEMPLATE;

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as any;

    const service = new SmsService();
    await expect(service.sendOtp('09123456789', '12345')).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
