import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ContactService } from './contact.service.js';
import { CreateContactDto } from './dto/create-contact.dto.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard.js';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator.js';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submitContactForm(
    @Body() dto: CreateContactDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    // Uses the socket address by default, or req.ip if express trust proxy is enabled
    const rawIp = req.socket?.remoteAddress || req.ip || '127.0.0.1';
    const userId = (req as Request & { user?: CurrentUserData }).user?.id ?? null;

    return this.contactService.createMessage(dto, rawIp, userId);
  }
}

