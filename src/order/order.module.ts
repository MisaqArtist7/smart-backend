import { Module } from '@nestjs/common';
import { OrderService } from './order.service.js';
import { OrderController } from './order.controller.js';
import { AdminOrderController } from './admin-order.controller.js';
import { PaymentInfoController } from './payment-info.controller.js';
import { ReceiptStorageService } from './receipt-storage.service.js';

@Module({
  controllers: [PaymentInfoController, OrderController, AdminOrderController],
  providers: [OrderService, ReceiptStorageService],
  exports: [OrderService, ReceiptStorageService],
})
export class OrderModule {}
