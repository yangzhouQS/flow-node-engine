/**
 * 集成模块
 * 提供各模块之间的集成服务
 */
import { Module } from '@nestjs/common';
import { TaskModule } from '../task/task.module';
import { ProcessInstanceModule } from '../process-instance/process-instance.module';
import { CommentModule } from '../comment/comment.module';
import { TaskCommentIntegrationService } from './services/task-comment-integration.service';
import { ProcessCommentIntegrationService } from './services/process-comment-integration.service';

@Module({
  imports: [
    TaskModule,
    ProcessInstanceModule,
    CommentModule,
  ],
  providers: [
    TaskCommentIntegrationService,
    ProcessCommentIntegrationService,
  ],
  exports: [
    TaskCommentIntegrationService,
    ProcessCommentIntegrationService,
  ],
})
export class IntegrationModule {}
