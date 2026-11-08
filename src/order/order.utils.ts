import { randomInt } from 'node:crypto';

/**
 * الفبای بدون ابهام برای تولید شماره سفارش (حذف 0, O, 1, I برای جلوگیری از اشتباه خریدار و پشتیبانی)
 */
export const ORDER_NUMBER_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * تولید شماره سفارش یکتا و خوانا با پیشوند SE- و ۸ کاراکتر تصادفی
 * مثال: SE-8K3P9M2X
 */
export function generateOrderNumber(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    const idx = randomInt(0, ORDER_NUMBER_ALPHABET.length);
    code += ORDER_NUMBER_ALPHABET[idx];
  }
  return `SE-${code}`;
}
