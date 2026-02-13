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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard';
import { DeployProcessDto } from '../dto/deploy-process.dto';
import { ProcessDefinition } from '../entities/process-definition.entity';
import { ProcessDefinitionService } from '../services/process-definition.service';

@ApiTags('流程定义管理')
@Controller('process-definitions')
@UseGuards(JwtAuthGuard)
export class ProcessDefinitionController {
  constructor(
    private readonly processDefinitionService: ProcessDefinitionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '部署流程定义' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '部署成功',
    type: ProcessDefinition,
  })
  async deploy(@Body() dto: DeployProcessDto): Promise<ProcessDefinition> {
    return this.processDefinitionService.deploy(dto);
  }

  @Get()
  @ApiOperation({ summary: '查询流程定义列表' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '查询成功',
    type: [ProcessDefinition],
  })
  async findAll(
    @Query('key') key?: string,
    @Query('category') category?: string,
  ): Promise<ProcessDefinition[]> {
    return this.processDefinitionService.findAll(key, category);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询流程定义详情' })
  @ApiParam({ name: 'id', description: '流程定义 ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '查询成功',
    type: ProcessDefinition,
  })
  async findById(@Param('id') id: string): Promise<ProcessDefinition | null> {
    return this.processDefinitionService.findById(id);
  }

  @Get('key/:key')
  @ApiOperation({ summary: '根据流程键查询最新版本' })
  @ApiParam({ name: 'key', description: '流程键' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '查询成功',
    type: ProcessDefinition,
  })
  async findByKey(@Param('key') key: string): Promise<ProcessDefinition | null> {
    return this.processDefinitionService.findByKey(key);
  }

  @Get('key/:key/version/:version')
  @ApiOperation({ summary: '根据流程键和版本查询' })
  @ApiParam({ name: 'key', description: '流程键' })
  @ApiParam({ name: 'version', description: '版本号' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '查询成功',
    type: ProcessDefinition,
  })
  async findByKeyAndVersion(
    @Param('key') key: string,
    @Param('version') version: number,
  ): Promise<ProcessDefinition | null> {
    return this.processDefinitionService.findByKeyAndVersion(key, version);
  }

  @Put(':id/activate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '激活流程定义' })
  @ApiParam({ name: 'id', description: '流程定义 ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: '激活成功',
  })
  async activate(@Param('id') id: string): Promise<void> {
    return this.processDefinitionService.activate(id);
  }

  @Put(':id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '挂起流程定义' })
  @ApiParam({ name: 'id', description: '流程定义 ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: '挂起成功',
  })
  async suspend(@Param('id') id: string): Promise<void> {
    return this.processDefinitionService.suspend(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除流程定义' })
  @ApiParam({ name: 'id', description: '流程定义 ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: '删除成功',
  })
  async delete(@Param('id') id: string): Promise<void> {
    return this.processDefinitionService.delete(id);
  }

  @Get(':id/diagram')
  @ApiOperation({ summary: '获取流程图' })
  @ApiParam({ name: 'id', description: '流程定义 ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    type: String,
  })
  async getDiagram(@Param('id') id: string): Promise<string | null> {
    return this.processDefinitionService.getDiagram(id);
  }

  @Get(':id/bpmn-xml')
  @ApiOperation({ summary: '获取 BPMN XML' })
  @ApiParam({ name: 'id', description: '流程定义 ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    type: String,
  })
  async getBpmnXml(@Param('id') id: string): Promise<string> {
    return this.processDefinitionService.getBpmnXml(id);
  }
}
