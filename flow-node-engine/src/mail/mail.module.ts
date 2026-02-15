/**
 * 邮件模块
 * 提供邮件发送和模板管理功能
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './services/mail.service';
import { MailTemplateService } from './services/mail-template.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [MailService, MailTemplateService],
  exports: [MailService, MailTemplateService],
})
export class MailModule {}
