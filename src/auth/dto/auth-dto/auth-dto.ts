import { Matches } from 'class-validator';

export class RequestOtpDto {
  @Matches(/^09\d{9}$/, { message: 'Invalid phone number' })
  phone: string;
}