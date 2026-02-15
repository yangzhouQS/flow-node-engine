/**
 * 内容模块
 * 管理内容项和附件
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { ContentController } from './controllers/content.controller';
import { ContentService } from './services/content.service';
import { StorageService } from './services/storage.service';
import { ContentItem } from './entities/content-item.entity';
import { Attachment } from './entities/attachment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentItem, Attachment]),
    ConfigModule,
  ],
  controllers: [ContentController],
  providers: [ContentService, StorageService],
  exports: [ContentService, StorageService],
})
export class ContentModule {}
