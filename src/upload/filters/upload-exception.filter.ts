import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class UploadExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Multer size limit exceeded -> 413 Payload Too Large
    if (
      exception?.code === 'LIMIT_FILE_SIZE' ||
      exception?.message?.includes('File too large')
    ) {
      return response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        message: 'File size exceeds the 5MB limit',
        error: 'Payload Too Large',
      });
    }

    // Preserve standard NestJS HttpExceptions (400, 401, 403, 404, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      return response
        .status(status)
        .json(
          typeof res === 'object'
            ? res
            : { statusCode: status, message: res },
        );
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Unexpected file upload error',
    });
  }
}

