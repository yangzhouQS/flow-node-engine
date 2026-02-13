import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

/**
 * 部署流程定义 DTO
 */
export class DeployProcessDto {
  @ApiProperty({ description: '流程名称', example: '请假流程' })
  @IsNotEmpty({ message: '流程名称不能为空' })
  @IsString({ message: '流程名称必须是字符串' })
  name: string;

  @ApiProperty({ description: '流程键', example: 'leave' })
  @IsNotEmpty({ message: '流程键不能为空' })
  @IsString({ message: '流程键必须是字符串' })
  key: string;

  @ApiProperty({ description: '流程分类', example: '人力资源', required: false })
  @IsOptional()
  @IsString({ message: '流程分类必须是字符串' })
  category?: string;

  @ApiProperty({ description: '流程描述', example: '员工请假审批流程', required: false })
  @IsOptional()
  @IsString({ message: '流程描述必须是字符串' })
  description?: string;

  @ApiProperty({ description: 'BPMN XML 内容' })
  @IsNotEmpty({ message: 'BPMN XML 内容不能为空' })
  @IsString({ message: 'BPMN XML 内容必须是字符串' })
  bpmnXml: string;

  @ApiProperty({ description: '是否生成流程图', example: false, required: false })
  @IsOptional()
  @IsBoolean({ message: '是否生成流程图必须是布尔值' })
  generateDiagram?: boolean;
}
