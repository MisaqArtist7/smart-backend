import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { DiscountsService } from './discounts.service.js';
import { ValidateDiscountDto } from './dto/validate-discount.dto.js';
import { CreateDiscountDto } from './dto/create-discount.dto.js';
import { UpdateDiscountDto } from './dto/update-discount.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';

@Controller()
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Post('discounts/validate')
  validate(
    @CurrentUser() user: { id: number },
    @Body() dto: ValidateDiscountDto,
  ) {
    return this.discountsService.validate(user.id, dto);
  }

  @Roles(Role.ADMIN)
  @Get('admin/discounts')
  findAll() {
    return this.discountsService.findAll();
  }

  @Roles(Role.ADMIN)
  @Post('admin/discounts')
  create(@Body() dto: CreateDiscountDto) {
    return this.discountsService.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/discounts/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDiscountDto,
  ) {
    return this.discountsService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete('admin/discounts/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.discountsService.remove(id);
  }
}

