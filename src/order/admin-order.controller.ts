import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { OrderService } from './order.service.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { AdminGetOrdersDto } from './dto/admin-get-orders.dto.js';
import { UpdatePaymentDto } from './dto/update-payment.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { AdminCancelOrderDto } from './dto/admin-cancel-order.dto.js';

@Roles(Role.ADMIN)
@Controller('admin/orders')
export class AdminOrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  async getOrders(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: AdminGetOrdersDto,
  ) {
    return this.orderService.getAdminOrders(query);
  }

  @Get(':id')
  async getOrderById(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.getAdminOrderById(id);
  }

  @Patch(':id/payment')
  async updatePayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.orderService.updatePaymentStatus(id, dto);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateOrderStatus(id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto?: AdminCancelOrderDto,
  ) {
    return this.orderService.cancelOrderByAdmin(id, dto?.adminNote);
  }

  @Get(':id/receipt')
  async getReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { stream, mimeType } =
      await this.orderService.getReceiptStreamForAdmin(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, no-cache');
    stream.pipe(res);
  }
}
