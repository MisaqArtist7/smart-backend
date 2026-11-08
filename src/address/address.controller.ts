import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AddressService } from './address.service.js';
import {
  CurrentUser,
  type CurrentUserData,
} from '../auth/decorators/current-user.decorator.js';
import { CreateAddressDto } from './dto/create-address.dto.js';
import { UpdateAddressDto } from './dto/update-address.dto.js';

@Controller('addresses')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAddress(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateAddressDto,
  ) {
    return this.addressService.createAddress(user.id, dto);
  }

  @Get()
  async getMyAddresses(@CurrentUser() user: CurrentUserData) {
    return this.addressService.getMyAddresses(user.id);
  }

  @Get(':id')
  async getMyAddressById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.addressService.getMyAddressById(id, user.id);
  }

  @Patch(':id/default')
  async setDefaultAddress(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.addressService.setDefaultAddress(id, user.id);
  }

  @Patch(':id')
  async updateAddress(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressService.updateAddress(id, user.id, dto);
  }

  @Delete(':id')
  async deleteAddress(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.addressService.deleteAddress(id, user.id);
  }
}

