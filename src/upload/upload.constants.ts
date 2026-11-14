export const UPLOAD_TYPE_MAP = {
  product: 'products',
  category: 'categories',
  brand: 'brands',
} as const;

export type UploadType = keyof typeof UPLOAD_TYPE_MAP;

export const MAX_UPLOAD_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export type SupportedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImageTypeInfo {
  ext: string;
  mime: SupportedImageMime;
}

