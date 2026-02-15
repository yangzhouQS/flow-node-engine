/**
 * 评论模块
 * 管理流程实例和任务的评论功能
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { CommentService } from './services/comment.service';
import { CommentController } from './controllers/comment.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment]),
  ],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}
