import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { AdminUsersController } from './admin-users.controller.js';

@Module({
  controllers: [AdminUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
