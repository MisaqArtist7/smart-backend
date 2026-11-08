import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { OrderService } from './order.service.js';
import {
  CurrentUser,
  type CurrentUserData,
} from '../auth/decorators/current-user.decorator.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { GetMyOrdersDto } from './dto/get-my-orders.dto.js';
import type { UploadedReceiptFile } from './receipt-storage.service.js';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateOrderDto,
  ) {
    return this.orderService.createOrder(user.id, dto);
  }

  @Get('my')
  async getMyOrders(
    @CurrentUser() user: CurrentUserData,
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: GetMyOrdersDto,
  ) {
    return this.orderService.getMyOrders(user.id, query);
  }

  @Get(':id')
  async getMyOrderById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.orderService.getMyOrderById(id, user.id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.orderService.cancelOrderByCustomer(id, user.id);
  }

  @Post(':id/receipt')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('receipt'))
  async uploadReceipt(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
    @UploadedFile() file?: UploadedReceiptFile,
  ) {
    return this.orderService.uploadReceipt(id, user.id, file);
  }

  @Get(':id/receipt')
  async getReceipt(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
    @Res() res: Response,
  ) {
    const { stream, mimeType } =
      await this.orderService.getReceiptStreamForUser(id, user.id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    stream.pipe(res);
  }
}
