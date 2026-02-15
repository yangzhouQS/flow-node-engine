/**
 * 内容模块
 * 管理内容项和附件
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContentController } from './controllers/content.controller';
import { Attachment } from './entities/attachment.entity';
import { ContentItem } from './entities/content-item.entity';
import { ContentService } from './services/content.service';
import { StorageService } from './services/storage.service';

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
