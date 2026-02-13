import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { DmnService } from '../services/dmn.service';
import {
  CreateDecisionDto,
  UpdateDecisionDto,
  QueryDecisionDto,
  DecisionResponseDto,
  ExecuteDecisionDto,
  DecisionResultDto,
  ExecutionHistoryDto,
} from '../dto/dmn.dto';

@ApiTags('DMN决策引擎')
@Controller('dmn')
export class DmnController {
  constructor(private readonly dmnService: DmnService) {}

  /**
   * 创建决策
   */
  @Post('decisions')
  @ApiOperation({ summary: '创建决策', description: '创建一个新的决策表定义' })
  @ApiResponse({ status: HttpStatus.CREATED, description: '创建成功', type: DecisionResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '请求参数错误' })
  async createDecision(@Body() dto: CreateDecisionDto): Promise<DecisionResponseDto> {
    return this.dmnService.createDecision(dto);
  }

  /**
   * 更新决策
   */
  @Put('decisions/:id')
  @ApiOperation({ summary: '更新决策', description: '更新决策表定义（仅限草稿状态）' })
  @ApiParam({ name: 'id', description: '决策ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '更新成功', type: DecisionResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '决策不存在' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '请求参数错误或决策已发布' })
  async updateDecision(
    @Param('id') id: string,
    @Body() dto: UpdateDecisionDto,
  ): Promise<DecisionResponseDto> {
    return this.dmnService.updateDecision(id, dto);
  }

  /**
   * 发布决策
   */
  @Post('decisions/:id/publish')
  @ApiOperation({ summary: '发布决策', description: '将决策表发布为可用状态' })
  @ApiParam({ name: 'id', description: '决策ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '发布成功', type: DecisionResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '决策不存在' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '决策已发布或验证失败' })
  async publishDecision(@Param('id') id: string): Promise<DecisionResponseDto> {
    return this.dmnService.publishDecision(id);
  }

  /**
   * 创建新版本
   */
  @Post('decisions/:id/versions')
  @ApiOperation({ summary: '创建新版本', description: '基于现有决策创建新版本' })
  @ApiParam({ name: 'id', description: '决策ID' })
  @ApiResponse({ status: HttpStatus.CREATED, description: '创建成功', type: DecisionResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '决策不存在' })
  async createNewVersion(@Param('id') id: string): Promise<DecisionResponseDto> {
    return this.dmnService.createNewVersion(id);
  }

  /**
   * 挂起决策
   */
  @Post('decisions/:id/suspend')
  @ApiOperation({ summary: '挂起决策', description: '挂起已发布的决策' })
  @ApiParam({ name: 'id', description: '决策ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '挂起成功', type: DecisionResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '决策不存在' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '只有已发布的决策可以挂起' })
  async suspendDecision(@Param('id') id: string): Promise<DecisionResponseDto> {
    return this.dmnService.suspendDecision(id);
  }

  /**
   * 激活决策
   */
  @Post('decisions/:id/activate')
  @ApiOperation({ summary: '激活决策', description: '激活已挂起的决策' })
  @ApiParam({ name: 'id', description: '决策ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '激活成功', type: DecisionResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '决策不存在' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '只有已挂起的决策可以激活' })
  async activateDecision(@Param('id') id: string): Promise<DecisionResponseDto> {
    return this.dmnService.activateDecision(id);
  }

  /**
   * 删除决策
   */
  @Delete('decisions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除决策', description: '删除草稿状态的决策' })
  @ApiParam({ name: 'id', description: '决策ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: '删除成功' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '决策不存在' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '已发布的决策不能删除' })
  async deleteDecision(@Param('id') id: string): Promise<void> {
    await this.dmnService.deleteDecision(id);
  }

  /**
   * 查询决策列表
   */
  @Get('decisions')
  @ApiOperation({ summary: '查询决策列表', description: '根据条件查询决策列表' })
  @ApiResponse({ status: HttpStatus.OK, description: '查询成功' })
  async queryDecisions(
    @Query() dto: QueryDecisionDto,
  ): Promise<{ data: DecisionResponseDto[]; total: number }> {
    return this.dmnService.queryDecisions(dto);
  }

  /**
   * 获取决策详情
   */
  @Get('decisions/:id')
  @ApiOperation({ summary: '获取决策详情', description: '根据ID获取决策详细信息' })
  @ApiParam({ name: 'id', description: '决策ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '获取成功', type: DecisionResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '决策不存在' })
  async getDecision(@Param('id') id: string): Promise<DecisionResponseDto> {
    return this.dmnService.getDecision(id);
  }

  /**
   * 通过Key获取决策
   */
  @Get('decisions/by-key/:key')
  @ApiOperation({ summary: '通过Key获取决策', description: '通过Key获取最新版本的已发布决策' })
  @ApiParam({ name: 'key', description: '决策Key' })
  @ApiQuery({ name: 'tenantId', description: '租户ID', required: false })
  @ApiResponse({ status: HttpStatus.OK, description: '获取成功', type: DecisionResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '决策不存在' })
  async getDecisionByKey(
    @Param('key') key: string,
    @Query('tenantId') tenantId?: string,
  ): Promise<DecisionResponseDto> {
    return this.dmnService.getDecisionByKey(key, tenantId);
  }

  /**
   * 执行决策
   */
  @Post('execute')
  @ApiOperation({ summary: '执行决策', description: '根据输入数据执行决策并返回结果' })
  @ApiResponse({ status: HttpStatus.OK, description: '执行成功', type: DecisionResultDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '决策不存在' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '请求参数错误或决策未发布' })
  async executeDecision(@Body() dto: ExecuteDecisionDto): Promise<DecisionResultDto> {
    return this.dmnService.executeDecision(dto);
  }

  /**
   * 获取执行历史
   */
  @Get('executions')
  @ApiOperation({ summary: '获取执行历史', description: '查询决策执行历史记录' })
  @ApiQuery({ name: 'decisionId', description: '决策ID', required: false })
  @ApiQuery({ name: 'processInstanceId', description: '流程实例ID', required: false })
  @ApiQuery({ name: 'page', description: '页码', required: false })
  @ApiQuery({ name: 'size', description: '每页数量', required: false })
  @ApiResponse({ status: HttpStatus.OK, description: '查询成功' })
  async getExecutionHistory(
    @Query('decisionId') decisionId?: string,
    @Query('processInstanceId') processInstanceId?: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ): Promise<{ data: ExecutionHistoryDto[]; total: number }> {
    return this.dmnService.getExecutionHistory(decisionId, processInstanceId, page, size);
  }

  /**
   * 获取决策统计
   */
  @Get('decisions/:id/statistics')
  @ApiOperation({ summary: '获取决策统计', description: '获取决策执行统计信息' })
  @ApiParam({ name: 'id', description: '决策ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '获取成功' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '决策不存在' })
  async getDecisionStatistics(@Param('id') id: string): Promise<{
    totalExecutions: number;
    successCount: number;
    failedCount: number;
    noMatchCount: number;
    avgExecutionTime: number;
  }> {
    return this.dmnService.getDecisionStatistics(id);
  }

  /**
   * 验证决策
   */
  @Post('decisions/:id/validate')
  @ApiOperation({ summary: '验证决策', description: '验证决策表定义是否有效' })
  @ApiParam({ name: 'id', description: '决策ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '验证完成' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '决策不存在' })
  async validateDecision(@Param('id') id: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    return this.dmnService.validateDecision(id);
  }
}
