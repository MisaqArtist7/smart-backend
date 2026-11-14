import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import {
  UpdateCommentStatusDto,
  ReplyCommentDto,
} from './dto/update-comment-status.dto.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role, CommentStatus } from '../generated/prisma/client.js';

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Public()
  @Get('comments/product/:productId')
  findProductComments(@Param('productId', ParseIntPipe) productId: number) {
    return this.commentsService.findProductComments(productId);
  }

  @Post('comments/product/:productId')
  createComment(
    @Param('productId', ParseIntPipe) productId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createComment(productId, user.id, dto);
  }

  @Roles(Role.ADMIN)
  @Get('admin/comments')
  adminFindAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: CommentStatus,
    @Query('productId') productId?: string,
  ) {
    return this.commentsService.adminFindAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      productId: productId ? Number(productId) : undefined,
    });
  }

  @Roles(Role.ADMIN)
  @Patch('admin/comments/:id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommentStatusDto,
  ) {
    return this.commentsService.updateStatus(id, dto.status);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/comments/:id/reply')
  replyComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplyCommentDto,
  ) {
    const text = dto.adminReply || dto.text || '';
    return this.commentsService.replyComment(id, text);
  }

  @Roles(Role.ADMIN)
  @Delete('admin/comments/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.commentsService.remove(id);
  }
}

