import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard';
import { CreateProcessInstanceDto } from '../dto/create-process-instance.dto';
import { QueryProcessInstanceDto } from '../dto/query-process-instance.dto';
import { UpdateProcessInstanceDto } from '../dto/update-process-instance.dto';
import { UpdateVariablesDto } from '../dto/update-variables.dto';
import { ProcessInstanceService } from '../services/process-instance.service';

@ApiTags('流程实例')
@Controller('process-instances')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProcessInstanceController {
  constructor(private readonly processInstanceService: ProcessInstanceService) {}

  @Post()
  @ApiOperation({ summary: '创建流程实例' })
  @ApiResponse({ status: 201, description: '创建成功', type: () => ApiResponseDto })
  async create(@Body() createProcessInstanceDto: CreateProcessInstanceDto) {
    const processInstance = await this.processInstanceService.create(
      createProcessInstanceDto.processDefinitionId,
      createProcessInstanceDto.businessKey,
      createProcessInstanceDto.startUserId,
      createProcessInstanceDto.variables,
      createProcessInstanceDto.tenantId,
    );
    return new ApiResponseDto(201, '创建成功', processInstance);
  }

  @Get()
  @ApiOperation({ summary: '查询所有流程实例' })
  @ApiResponse({ status: 200, description: '查询成功', type: () => ApiResponseDto })
  async findAll(@Query() query: QueryProcessInstanceDto) {
    const { page, pageSize, state, tenantId, processDefinitionId, businessKey } = query;

    let result;
    if (processDefinitionId) {
      result = await this.processInstanceService.findByProcessDefinitionId(
        processDefinitionId,
        page,
        pageSize,
      );
    } else if (businessKey) {
      const processInstance = await this.processInstanceService.findByBusinessKey(businessKey, tenantId);
      result = { data: [processInstance], total: 1 };
    } else {
      result = await this.processInstanceService.findAll(page, pageSize, state, tenantId);
    }

    return new ApiResponseDto(200, '查询成功', result.data, result.total);
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID查询流程实例' })
  @ApiResponse({ status: 200, description: '查询成功', type: () => ApiResponseDto })
  async findById(@Param('id') id: string) {
    const processInstance = await this.processInstanceService.findById(id);
    return new ApiResponseDto(200, '查询成功', processInstance);
  }

  @Get('business-key/:businessKey')
  @ApiOperation({ summary: '根据业务键查询流程实例' })
  @ApiResponse({ status: 200, description: '查询成功', type: () => ApiResponseDto })
  async findByBusinessKey(
    @Param('businessKey') businessKey: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const processInstance = await this.processInstanceService.findByBusinessKey(businessKey, tenantId);
    return new ApiResponseDto(200, '查询成功', processInstance);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新流程实例' })
  @ApiResponse({ status: 200, description: '更新成功', type: () => ApiResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateProcessInstanceDto: UpdateProcessInstanceDto,
  ) {
    const processInstance = await this.processInstanceService.update(id, updateProcessInstanceDto);
    return new ApiResponseDto(200, '更新成功', processInstance);
  }

  @Put(':id/variables')
  @ApiOperation({ summary: '更新流程实例变量' })
  @ApiResponse({ status: 200, description: '更新成功', type: () => ApiResponseDto })
  async updateVariables(
    @Param('id') id: string,
    @Body() updateVariablesDto: UpdateVariablesDto,
  ) {
    const processInstance = await this.processInstanceService.updateVariables(
      id,
      updateVariablesDto.variables,
    );
    return new ApiResponseDto(200, '更新成功', processInstance);
  }

  @Get(':id/variables')
  @ApiOperation({ summary: '获取流程实例变量' })
  @ApiResponse({ status: 200, description: '查询成功', type: () => ApiResponseDto })
  async getVariables(@Param('id') id: string) {
    const variables = await this.processInstanceService.getVariables(id);
    return new ApiResponseDto(200, '查询成功', variables);
  }

  @Get(':id/variables/:name')
  @ApiOperation({ summary: '获取流程实例单个变量' })
  @ApiResponse({ status: 200, description: '查询成功', type: () => ApiResponseDto })
  async getVariable(@Param('id') id: string, @Param('name') name: string) {
    const variable = await this.processInstanceService.getVariable(id, name);
    return new ApiResponseDto(200, '查询成功', { name, value: variable });
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除流程实例' })
  @ApiResponse({ status: 200, description: '删除成功', type: () => ApiResponseDto })
  async delete(
    @Param('id') id: string,
    @Body('deleteReason') deleteReason?: string,
  ) {
    await this.processInstanceService.delete(id, deleteReason);
    return new ApiResponseDto(200, '删除成功');
  }

  @Delete()
  @ApiOperation({ summary: '批量删除流程实例' })
  @ApiResponse({ status: 200, description: '删除成功', type: () => ApiResponseDto })
  async deleteMany(
    @Body('ids') ids: string[],
    @Body('deleteReason') deleteReason?: string,
  ) {
    await this.processInstanceService.deleteMany(ids, deleteReason);
    return new ApiResponseDto(200, '删除成功');
  }

  @Put(':id/suspend')
  @ApiOperation({ summary: '挂起流程实例' })
  @ApiResponse({ status: 200, description: '挂起成功', type: () => ApiResponseDto })
  async suspend(@Param('id') id: string) {
    const processInstance = await this.processInstanceService.suspend(id);
    return new ApiResponseDto(200, '挂起成功', processInstance);
  }

  @Put(':id/activate')
  @ApiOperation({ summary: '激活流程实例' })
  @ApiResponse({ status: 200, description: '激活成功', type: () => ApiResponseDto })
  async activate(@Param('id') id: string) {
    const processInstance = await this.processInstanceService.activate(id);
    return new ApiResponseDto(200, '激活成功', processInstance);
  }

  @Put(':id/complete')
  @ApiOperation({ summary: '完成流程实例' })
  @ApiResponse({ status: 200, description: '完成成功', type: () => ApiResponseDto })
  async complete(@Param('id') id: string) {
    const processInstance = await this.processInstanceService.complete(id);
    return new ApiResponseDto(200, '完成成功', processInstance);
  }

  @Get(':id/executions')
  @ApiOperation({ summary: '获取流程实例的执行实例列表' })
  @ApiResponse({ status: 200, description: '查询成功', type: () => ApiResponseDto })
  async getExecutions(@Param('id') id: string) {
    const executions = await this.processInstanceService.getExecutions(id);
    return new ApiResponseDto(200, '查询成功', executions);
  }

  @Get(':id/variables-list')
  @ApiOperation({ summary: '获取流程实例的变量列表' })
  @ApiResponse({ status: 200, description: '查询成功', type: () => ApiResponseDto })
  async getVariableList(@Param('id') id: string) {
    const variables = await this.processInstanceService.getVariableList(id);
    return new ApiResponseDto(200, '查询成功', variables);
  }

  @Get('count')
  @ApiOperation({ summary: '统计流程实例数量' })
  @ApiResponse({ status: 200, description: '查询成功', type: () => ApiResponseDto })
  async count(@Query('state') state?: string, @Query('tenantId') tenantId?: string) {
    const count = await this.processInstanceService.count(state, tenantId);
    return new ApiResponseDto(200, '查询成功', { count });
  }
}
