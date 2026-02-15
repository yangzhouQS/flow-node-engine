/**
 * 内容控制器
 * 提供内容项和附件的REST API
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Logger,
  Res,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import {
  CreateContentItemDto,
  UpdateContentItemDto,
  QueryContentItemDto,
  CreateAttachmentDto,
  QueryAttachmentDto,
  ContentItemResponseDto,
  AttachmentResponseDto,
  ContentPageResponseDto,
  UploadFileResponseDto,
} from '../dto/content.dto';
import { ContentService } from '../services/content.service';

@ApiTags('内容管理')
@ApiBearerAuth()
@Controller('content')
export class ContentController {
  private readonly logger = new Logger(ContentController.name);

  constructor(private readonly contentService: ContentService) {}

  // ==================== 内容项接口 ====================

  /**
   * 创建内容项
   */
  @Post('items')
  @ApiOperation({ summary: '创建内容项', description: '创建一个新的内容项' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async createContentItem(@Body() dto: CreateContentItemDto): Promise<ContentItemResponseDto> {
    return this.contentService.createContentItem(dto);
  }

  /**
   * 上传单个文件
   */
  @Post('upload')
  @ApiOperation({ summary: '上传文件', description: '上传单个文件并创建内容项' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: '上传成功' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { processInstanceId?: string; taskId?: string; scopeId?: string; scopeType?: string; description?: string; userId?: string; tenantId?: string }
  ): Promise<UploadFileResponseDto> {
    if (!file) {
      throw new Error('No file uploaded');
    }
    return this.contentService.uploadFile(file, {
      processInstanceId: body.processInstanceId,
      taskId: body.taskId,
      scopeId: body.scopeId,
      scopeType: body.scopeType,
      userId: body.userId,
      tenantId: body.tenantId,
      description: body.description,
    });
  }

  /**
   * 上传多个文件
   */
  @Post('upload/multiple')
  @ApiOperation({ summary: '批量上传文件', description: '上传多个文件并创建内容项' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: '上传成功' })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { processInstanceId?: string; taskId?: string; scopeId?: string; scopeType?: string; userId?: string; tenantId?: string }
  ): Promise<UploadFileResponseDto[]> {
    if (!files || files.length === 0) {
      throw new Error('No files uploaded');
    }

    const results: UploadFileResponseDto[] = [];
    for (const file of files) {
      const result = await this.contentService.uploadFile(file, {
        processInstanceId: body.processInstanceId,
        taskId: body.taskId,
        scopeId: body.scopeId,
        scopeType: body.scopeType,
        userId: body.userId,
        tenantId: body.tenantId,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * 查询内容项列表
   */
  @Get('items')
  @ApiOperation({ summary: '查询内容项列表', description: '根据条件查询内容项列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async queryContentItems(@Query() query: QueryContentItemDto): Promise<ContentPageResponseDto<ContentItemResponseDto>> {
    return this.contentService.queryContentItems(query);
  }

  /**
   * 获取内容项详情
   */
  @Get('items/:id')
  @ApiOperation({ summary: '获取内容项详情', description: '根据ID获取内容项详情' })
  @ApiParam({ name: 'id', description: '内容项ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '内容项不存在' })
  async getContentItem(@Param('id', ParseUUIDPipe) id: string): Promise<ContentItemResponseDto> {
    return this.contentService.findContentItemById(id);
  }

  /**
   * 更新内容项
   */
  @Put('items/:id')
  @ApiOperation({ summary: '更新内容项', description: '更新内容项信息' })
  @ApiParam({ name: 'id', description: '内容项ID' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 404, description: '内容项不存在' })
  async updateContentItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentItemDto
  ): Promise<ContentItemResponseDto> {
    return this.contentService.updateContentItem(id, dto);
  }

  /**
   * 删除内容项
   */
  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除内容项', description: '删除指定内容项' })
  @ApiParam({ name: 'id', description: '内容项ID' })
  @ApiResponse({ status: 204, description: '删除成功' })
  @ApiResponse({ status: 404, description: '内容项不存在' })
  async deleteContentItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body?: { deletedBy?: string }
  ): Promise<void> {
    return this.contentService.deleteContentItem(id, body?.deletedBy);
  }

  /**
   * 归档内容项
   */
  @Put('items/:id/archive')
  @ApiOperation({ summary: '归档内容项', description: '归档指定内容项' })
  @ApiParam({ name: 'id', description: '内容项ID' })
  @ApiResponse({ status: 200, description: '归档成功' })
  async archiveContentItem(@Param('id', ParseUUIDPipe) id: string): Promise<ContentItemResponseDto> {
    return this.contentService.archiveContentItem(id);
  }

  /**
   * 下载文件
   */
  @Get('items/:id/download')
  @ApiOperation({ summary: '下载文件', description: '下载内容项关联的文件' })
  @ApiParam({ name: 'id', description: '内容项ID' })
  @ApiResponse({ status: 200, description: '下载成功' })
  @ApiResponse({ status: 404, description: '内容项不存在' })
  @Header('Content-Disposition', 'attachment')
  async downloadFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const { buffer, mimeType, name } = await this.contentService.getContentFile(id);
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
    
    return new StreamableFile(buffer);
  }

  // ==================== 附件接口 ====================

  /**
   * 创建附件
   */
  @Post('attachments')
  @ApiOperation({ summary: '创建附件', description: '创建内容项与业务对象的关联' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async createAttachment(@Body() dto: CreateAttachmentDto): Promise<AttachmentResponseDto> {
    return this.contentService.createAttachment(dto);
  }

  /**
   * 查询附件列表
   */
  @Get('attachments')
  @ApiOperation({ summary: '查询附件列表', description: '根据条件查询附件列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async queryAttachments(@Query() query: QueryAttachmentDto): Promise<ContentPageResponseDto<AttachmentResponseDto>> {
    return this.contentService.queryAttachments(query);
  }

  /**
   * 删除附件
   */
  @Delete('attachments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除附件', description: '软删除指定附件' })
  @ApiParam({ name: 'id', description: '附件ID' })
  @ApiResponse({ status: 204, description: '删除成功' })
  @ApiResponse({ status: 404, description: '附件不存在' })
  async deleteAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body?: { deletedBy?: string }
  ): Promise<void> {
    return this.contentService.deleteAttachment(id, body?.deletedBy);
  }

  /**
   * 恢复附件
   */
  @Put('attachments/:id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '恢复附件', description: '恢复已删除的附件' })
  @ApiParam({ name: 'id', description: '附件ID' })
  @ApiResponse({ status: 204, description: '恢复成功' })
  async restoreAttachment(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.contentService.restoreAttachment(id);
  }

  // ==================== 便捷接口 ====================

  /**
   * 获取流程实例的附件
   */
  @Get('process-instances/:processInstanceId/attachments')
  @ApiOperation({ summary: '获取流程实例附件', description: '获取指定流程实例的所有附件' })
  @ApiParam({ name: 'processInstanceId', description: '流程实例ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getProcessInstanceAttachments(
    @Param('processInstanceId') processInstanceId: string,
    @Query() query: QueryAttachmentDto
  ): Promise<ContentPageResponseDto<AttachmentResponseDto>> {
    return this.contentService.queryAttachments({
      ...query,
      processInstanceId,
    });
  }

  /**
   * 获取任务的附件
   */
  @Get('tasks/:taskId/attachments')
  @ApiOperation({ summary: '获取任务附件', description: '获取指定任务的所有附件' })
  @ApiParam({ name: 'taskId', description: '任务ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getTaskAttachments(
    @Param('taskId') taskId: string,
    @Query() query: QueryAttachmentDto
  ): Promise<ContentPageResponseDto<AttachmentResponseDto>> {
    return this.contentService.queryAttachments({
      ...query,
      taskId,
    });
  }

  /**
   * 获取流程实例的内容项
   */
  @Get('process-instances/:processInstanceId/items')
  @ApiOperation({ summary: '获取流程实例内容项', description: '获取指定流程实例的所有内容项' })
  @ApiParam({ name: 'processInstanceId', description: '流程实例ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getProcessInstanceContentItems(
    @Param('processInstanceId') processInstanceId: string,
    @Query() query: QueryContentItemDto
  ): Promise<ContentPageResponseDto<ContentItemResponseDto>> {
    return this.contentService.queryContentItems({
      ...query,
      processInstanceId,
    });
  }

  /**
   * 获取任务的内容项
   */
  @Get('tasks/:taskId/items')
  @ApiOperation({ summary: '获取任务内容项', description: '获取指定任务的所有内容项' })
  @ApiParam({ name: 'taskId', description: '任务ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getTaskContentItems(
    @Param('taskId') taskId: string,
    @Query() query: QueryContentItemDto
  ): Promise<ContentPageResponseDto<ContentItemResponseDto>> {
    return this.contentService.queryContentItems({
      ...query,
      taskId,
    });
  }
}
