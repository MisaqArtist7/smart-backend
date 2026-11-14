import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { UPLOAD_TYPE_MAP, type UploadType } from '../upload.constants.js';

export class AdminUploadDto {
  @IsString({ message: 'Upload type must be a string' })
  @IsNotEmpty({ message: 'Upload type is required' })
  @IsIn(Object.keys(UPLOAD_TYPE_MAP), {
    message: 'Invalid upload type. Allowed types: product, category, brand',
  })
  type: UploadType;
}

