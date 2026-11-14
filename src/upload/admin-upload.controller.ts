import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService, type UploadedFileInput } from './upload.service.js';
import { AdminUploadDto } from './dto/admin-upload.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { MAX_UPLOAD_FILE_SIZE } from './upload.constants.js';
import { UploadExceptionFilter } from './filters/upload-exception.filter.js';

@Roles(Role.ADMIN)
@Controller('admin/uploads')
@UseFilters(UploadExceptionFilter)
export class AdminUploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_UPLOAD_FILE_SIZE,
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: UploadedFileInput,
    @Body() dto: AdminUploadDto,
  ): Promise<{ path: string }> {
    return this.uploadService.saveFile(file, dto.type);
  }
}
