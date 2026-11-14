import { IsEnum } from 'class-validator';
import { CommentStatus } from '../../generated/prisma/client.js';

export class UpdateCommentStatusDto {
  @IsEnum(CommentStatus)
  status: CommentStatus;
}

export class ReplyCommentDto {
  text?: string;
  adminReply?: string;
}

