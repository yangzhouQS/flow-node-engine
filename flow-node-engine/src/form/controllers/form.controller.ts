import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard';
import { CreateFormDto } from '../dto/create-form.dto';
import { QueryFormDto } from '../dto/query-form.dto';
import { UpdateFormDto } from '../dto/update-form.dto';
import { ValidateFormDto, ValidateSingleFieldDto, ValidationResultDto, JsonSchemaDto } from '../dto/form-validation.dto';
import { FormService } from '../services/form.service';
import { FormValidationService } from '../services/form-validation.service';

@ApiTags('表单')
@Controller('forms')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FormController {
  constructor(
    private readonly formService: FormService,
    private readonly formValidationService: FormValidationService,
  ) {}

  @Post()
  @ApiOperation({ summary: '创建表单' })
  @ApiResponse({ status: 201, description: '创建成功', type: ApiResponseDto })
  async create(@Body() createFormDto: CreateFormDto) {
    const form = await this.formService.create(
      createFormDto.formKey,
      createFormDto.name,
      createFormDto.formDefinition,
      createFormDto.description,
      createFormDto.version,
      createFormDto.deploymentId,
      createFormDto.tenantId,
      createFormDto.resourceName,
      createFormDto.isSystem,
    );
    return new ApiResponseDto(201, '创建成功', form);
  }

  @Get()
  @ApiOperation({ summary: '查询所有表单' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  async findAll(@Query() query: QueryFormDto) {
    const { page, pageSize, formKey, tenantId } = query;

    const result = await this.formService.findAll(page, pageSize, formKey, tenantId);
    return new ApiResponseDto(200, '查询成功', result.data, result.total);
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID查询表单' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  async findById(@Param('id') id: string) {
    const form = await this.formService.findById(id);
    return new ApiResponseDto(200, '查询成功', form);
  }

  @Get('form-key/:formKey')
  @ApiOperation({ summary: '根据表单键查询表单' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  async findByFormKey(
    @Param('formKey') formKey: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const form = await this.formService.findByFormKey(formKey, tenantId);
    return new ApiResponseDto(200, '查询成功', form);
  }

  @Get('latest/:formKey')
  @ApiOperation({ summary: '获取表单最新版本' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  async getLatestVersion(
    @Param('formKey') formKey: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const form = await this.formService.getLatestVersion(formKey, tenantId);
    return new ApiResponseDto(200, '查询成功', form);
  }

  @Get('deployment/:deploymentId')
  @ApiOperation({ summary: '根据部署ID查询表单列表' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  async findByDeploymentId(@Param('deploymentId') deploymentId: string) {
    const forms = await this.formService.findByDeploymentId(deploymentId);
    return new ApiResponseDto(200, '查询成功', forms);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新表单' })
  @ApiResponse({ status: 200, description: '更新成功', type: ApiResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateFormDto: UpdateFormDto,
  ) {
    const form = await this.formService.update(id, updateFormDto);
    return new ApiResponseDto(200, '更新成功', form);
  }

  @Put(':id/definition')
  @ApiOperation({ summary: '更新表单定义' })
  @ApiResponse({ status: 200, description: '更新成功', type: ApiResponseDto })
  async updateFormDefinition(
    @Param('id') id: string,
    @Body('formDefinition') formDefinition: Record<string, any>,
  ) {
    const form = await this.formService.updateFormDefinition(id, formDefinition);
    return new ApiResponseDto(200, '更新成功', form);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除表单' })
  @ApiResponse({ status: 200, description: '删除成功', type: ApiResponseDto })
  async delete(@Param('id') id: string) {
    await this.formService.delete(id);
    return new ApiResponseDto(200, '删除成功');
  }

  @Delete()
  @ApiOperation({ summary: '批量删除表单' })
  @ApiResponse({ status: 200, description: '删除成功', type: ApiResponseDto })
  async deleteMany(@Body('ids') ids: string[]) {
    await this.formService.deleteMany(ids);
    return new ApiResponseDto(200, '删除成功');
  }

  @Get('count')
  @ApiOperation({ summary: '统计表单数量' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  async count(@Query('formKey') formKey?: string, @Query('tenantId') tenantId?: string) {
    const count = await this.formService.count(formKey, tenantId);
    return new ApiResponseDto(200, '查询成功', { count });
  }

  // ==================== 表单验证相关接口 ====================

  @Post('validate')
  @ApiOperation({ summary: '验证表单数据' })
  @ApiResponse({ status: 200, description: '验证完成', type: ValidationResultDto })
  async validateForm(@Body() validateFormDto: ValidateFormDto): Promise<ValidationResultDto> {
    if (validateFormDto.formId) {
      return this.formValidationService.validateFormById(
        validateFormDto.formId,
        validateFormDto.data,
        validateFormDto.variables,
      );
    } else if (validateFormDto.formKey) {
      return this.formValidationService.validateFormByKey(
        validateFormDto.formKey,
        validateFormDto.data,
        validateFormDto.variables,
        validateFormDto.tenantId,
      );
    } else {
      return {
        valid: false,
        errors: [
          {
            fieldId: '',
            fieldName: '',
            message: '必须提供formId或formKey',
            ruleType: 'required',
          },
        ],
      };
    }
  }

  @Post('validate/field')
  @ApiOperation({ summary: '验证单个字段' })
  @ApiResponse({ status: 200, description: '验证完成', type: ValidationResultDto })
  async validateSingleField(@Body() validateFieldDto: ValidateSingleFieldDto): Promise<ValidationResultDto> {
    return this.formValidationService.validateSingleField(
      validateFieldDto.formId,
      validateFieldDto.fieldId,
      validateFieldDto.value,
      validateFieldDto.data,
      validateFieldDto.variables,
    );
  }

  @Get(':id/json-schema')
  @ApiOperation({ summary: '获取表单的JSON Schema' })
  @ApiResponse({ status: 200, description: '获取成功', type: JsonSchemaDto })
  async getJsonSchema(@Param('id') id: string): Promise<JsonSchemaDto> {
    const form = await this.formService.findById(id);
    const schema = this.formValidationService.toJsonSchema(form.formDefinition as any);
    return { schema };
  }

  @Get('form-key/:formKey/json-schema')
  @ApiOperation({ summary: '根据表单键获取JSON Schema' })
  @ApiResponse({ status: 200, description: '获取成功', type: JsonSchemaDto })
  async getJsonSchemaByFormKey(
    @Param('formKey') formKey: string,
    @Query('tenantId') tenantId?: string,
  ): Promise<JsonSchemaDto> {
    const form = await this.formService.findByFormKey(formKey, tenantId);
    const schema = this.formValidationService.toJsonSchema(form.formDefinition as any);
    return { schema };
  }
}
