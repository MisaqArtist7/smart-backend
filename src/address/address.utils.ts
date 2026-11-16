export const PRIMARY_PHONE_REGEX = /^09\d{9}$/;
export const SECONDARY_PHONE_REGEX = /^0(9\d{9}|[1-8]\d{9})$/;
export const POSTAL_CODE_REGEX = /^\d{10}$/;
export const NO_CONTROL_CHARS_REGEX = /^[^\x00-\x1F\x7F]+$/;

export function toEnglishDigits(input: string): string {
  return input
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

export function normalizePhoneInput(
  value: unknown,
  emptyAsUndefined = false,
): unknown {
  if (typeof value !== 'string') return value;
  const normalized = toEnglishDigits(value).replace(/[\s\-()]/g, '');
  if (emptyAsUndefined && normalized === '') {
    return undefined;
  }
  return normalized;
}

export function normalizePostalCodeInput(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const normalized = toEnglishDigits(value).replace(/[\s\-()]/g, '');
  return normalized === '' ? undefined : normalized;
}

export function trimRequiredText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.trim();
}

export function trimOptionalText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export interface FullAddressParts {
  province: string;
  city: string;
  neighborhood?: string | null;
  streetAddress: string;
  plaque: string;
  floor?: string | null;
  unit?: string | null;
}

export function formatFullAddress(parts: FullAddressParts): string {
  const segments = [
    parts.province,
    parts.city,
    parts.neighborhood ? `محله ${parts.neighborhood}` : null,
    parts.streetAddress,
    `پلاک ${parts.plaque}`,
    parts.floor ? `طبقه ${parts.floor}` : null,
    parts.unit ? `واحد ${parts.unit}` : null,
  ].filter(Boolean);

  return segments.join('، ');
}
