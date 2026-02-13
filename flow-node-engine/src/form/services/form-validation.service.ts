import { Injectable, Logger } from '@nestjs/common';

import {
  FormDefinition,
  FormFieldDefinition,
  FieldValidationRule,
  ValidationResult,
  ValidationError,
  FieldValidationContext,
  FormFieldType,
} from '../interfaces/form-validation.interface';

import { FormService } from './form.service';

/**
 * 表单验证服务
 * 提供基于JSON Schema和自定义规则的表单验证功能
 */
@Injectable()
export class FormValidationService {
  private readonly logger = new Logger(FormValidationService.name);

  constructor(private readonly formService: FormService) {}

  /**
   * 验证表单数据
   * @param formId 表单ID
   * @param data 表单数据
   * @param variables 上下文变量（流程变量等）
   */
  async validateFormById(
    formId: string,
    data: Record<string, any>,
    variables?: Record<string, any>,
  ): Promise<ValidationResult> {
    const form = await this.formService.findById(formId);
    return this.validateFormDefinition(form.formDefinition as FormDefinition, data, variables);
  }

  /**
   * 根据表单键验证表单数据
   * @param formKey 表单键
   * @param data 表单数据
   * @param variables 上下文变量
   * @param tenantId 租户ID
   */
  async validateFormByKey(
    formKey: string,
    data: Record<string, any>,
    variables?: Record<string, any>,
    tenantId?: string,
  ): Promise<ValidationResult> {
    const form = await this.formService.findByFormKey(formKey, tenantId);
    return this.validateFormDefinition(form.formDefinition as FormDefinition, data, variables);
  }

  /**
   * 根据表单定义验证表单数据
   * @param formDefinition 表单定义
   * @param data 表单数据
   * @param variables 上下文变量
   */
  validateFormDefinition(
    formDefinition: FormDefinition,
    data: Record<string, any>,
    variables?: Record<string, any>,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const fields = formDefinition.fields || [];

    // 验证每个字段
    for (const field of fields) {
      const fieldErrors = this.validateField(field, data, fields, variables);
      errors.push(...fieldErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证单个字段
   * @param field 字段定义
   * @param data 表单数据
   * @param allFields 所有字段定义
   * @param variables 上下文变量
   */
  validateField(
    field: FormFieldDefinition,
    data: Record<string, any>,
    allFields: FormFieldDefinition[],
    variables?: Record<string, any>,
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const value = data[field.id];

    // 跳过隐藏或禁用的字段
    if (field.hidden || field.disabled) {
      return errors;
    }

    // 构建验证上下文
    const context: FieldValidationContext = {
      value,
      field,
      formData: data,
      allFields,
      variables: variables || {},
    };

    // 执行验证规则
    const validationRules = field.validation || [];
    for (const rule of validationRules) {
      const error = this.executeValidationRule(rule, context);
      if (error) {
        errors.push(error);
        // 如果是必填验证失败，不再执行其他验证
        if (rule.type === 'required') {
          break;
        }
      }
    }

    // 类型验证
    if (value !== undefined && value !== null && value !== '') {
      const typeError = this.validateFieldType(context);
      if (typeError) {
        errors.push(typeError);
      }
    }

    // 嵌套字段验证（对象或数组类型）
    if (field.fields && field.fields.length > 0) {
      if (field.type === FormFieldType.OBJECT) {
        const nestedData = value || {};
        for (const nestedField of field.fields) {
          const nestedErrors = this.validateField(nestedField, nestedData, field.fields, variables);
          // 调整错误信息，添加父字段前缀
          for (const error of nestedErrors) {
            errors.push({
              ...error,
              fieldId: `${field.id}.${error.fieldId}`,
              fieldName: `${field.label}.${error.fieldName}`,
            });
          }
        }
      } else if (field.type === FormFieldType.ARRAY && Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const itemData = value[i];
          for (const nestedField of field.fields) {
            const nestedErrors = this.validateField(nestedField, itemData, field.fields, variables);
            for (const error of nestedErrors) {
              errors.push({
                ...error,
                fieldId: `${field.id}[${i}].${error.fieldId}`,
                fieldName: `${field.label}[${i + 1}].${error.fieldName}`,
              });
            }
          }
        }
      }
    }

    return errors;
  }

  /**
   * 执行单个验证规则
   * @param rule 验证规则
   * @param context 验证上下文
   */
  private executeValidationRule(
    rule: FieldValidationRule,
    context: FieldValidationContext,
  ): ValidationError | null {
    const { value, field } = context;

    switch (rule.type) {
      case 'required':
        return this.validateRequired(rule, context);

      case 'min':
        return this.validateMin(rule, context);

      case 'max':
        return this.validateMax(rule, context);

      case 'minLength':
        return this.validateMinLength(rule, context);

      case 'maxLength':
        return this.validateMaxLength(rule, context);

      case 'pattern':
        return this.validatePattern(rule, context);

      case 'email':
        return this.validateEmail(rule, context);

      case 'url':
        return this.validateUrl(rule, context);

      case 'custom':
        return this.validateCustom(rule, context);

      default:
        this.logger.warn(`未知的验证规则类型: ${rule.type}`);
        return null;
    }
  }

  /**
   * 必填验证
   */
  private validateRequired(rule: FieldValidationRule, context: FieldValidationContext): ValidationError | null {
    const { value, field } = context;

    if (value === undefined || value === null || value === '') {
      return {
        fieldId: field.id,
        fieldName: field.label,
        message: rule.message || `${field.label}是必填字段`,
        ruleType: 'required',
      };
    }

    // 数组类型检查是否为空数组
    if (Array.isArray(value) && value.length === 0) {
      return {
        fieldId: field.id,
        fieldName: field.label,
        message: rule.message || `${field.label}不能为空`,
        ruleType: 'required',
      };
    }

    return null;
  }

  /**
   * 最小值验证
   */
  private validateMin(rule: FieldValidationRule, context: FieldValidationContext): ValidationError | null {
    const { value, field } = context;

    if (typeof value !== 'number' || isNaN(value)) {
      return null;
    }

    const minValue = Number(rule.value);
    if (value < minValue) {
      return {
        fieldId: field.id,
        fieldName: field.label,
        message: rule.message || `${field.label}不能小于${minValue}`,
        ruleType: 'min',
      };
    }

    return null;
  }

  /**
   * 最大值验证
   */
  private validateMax(rule: FieldValidationRule, context: FieldValidationContext): ValidationError | null {
    const { value, field } = context;

    if (typeof value !== 'number' || isNaN(value)) {
      return null;
    }

    const maxValue = Number(rule.value);
    if (value > maxValue) {
      return {
        fieldId: field.id,
        fieldName: field.label,
        message: rule.message || `${field.label}不能大于${maxValue}`,
        ruleType: 'max',
      };
    }

    return null;
  }

  /**
   * 最小长度验证
   */
  private validateMinLength(rule: FieldValidationRule, context: FieldValidationContext): ValidationError | null {
    const { value, field } = context;

    const length = this.getValueLength(value);
    if (length === null) {
      return null;
    }

    const minLength = Number(rule.value);
    if (length < minLength) {
      return {
        fieldId: field.id,
        fieldName: field.label,
        message: rule.message || `${field.label}长度不能少于${minLength}个字符`,
        ruleType: 'minLength',
      };
    }

    return null;
  }

  /**
   * 最大长度验证
   */
  private validateMaxLength(rule: FieldValidationRule, context: FieldValidationContext): ValidationError | null {
    const { value, field } = context;

    const length = this.getValueLength(value);
    if (length === null) {
      return null;
    }

    const maxLength = Number(rule.value);
    if (length > maxLength) {
      return {
        fieldId: field.id,
        fieldName: field.label,
        message: rule.message || `${field.label}长度不能超过${maxLength}个字符`,
        ruleType: 'maxLength',
      };
    }

    return null;
  }

  /**
   * 正则表达式验证
   */
  private validatePattern(rule: FieldValidationRule, context: FieldValidationContext): ValidationError | null {
    const { value, field } = context;

    if (typeof value !== 'string' || value === '') {
      return null;
    }

    try {
      const regex = new RegExp(rule.value as string);
      if (!regex.test(value)) {
        return {
          fieldId: field.id,
          fieldName: field.label,
          message: rule.message || `${field.label}格式不正确`,
          ruleType: 'pattern',
        };
      }
    } catch (e) {
      this.logger.error(`无效的正则表达式: ${rule.value}`);
    }

    return null;
  }

  /**
   * 邮箱验证
   */
  private validateEmail(rule: FieldValidationRule, context: FieldValidationContext): ValidationError | null {
    const { value, field } = context;

    if (typeof value !== 'string' || value === '') {
      return null;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(value)) {
      return {
        fieldId: field.id,
        fieldName: field.label,
        message: rule.message || `${field.label}不是有效的邮箱地址`,
        ruleType: 'email',
      };
    }

    return null;
  }

  /**
   * URL验证
   */
  private validateUrl(rule: FieldValidationRule, context: FieldValidationContext): ValidationError | null {
    const { value, field } = context;

    if (typeof value !== 'string' || value === '') {
      return null;
    }

    try {
      new URL(value);
    } catch {
      return {
        fieldId: field.id,
        fieldName: field.label,
        message: rule.message || `${field.label}不是有效的URL`,
        ruleType: 'url',
      };
    }

    return null;
  }

  /**
   * 自定义验证
   * 支持表达式验证
   */
  private validateCustom(rule: FieldValidationRule, context: FieldValidationContext): ValidationError | null {
    const { value, field, formData, variables } = context;

    if (!rule.expression) {
      return null;
    }

    try {
      // 创建安全的执行环境
      const safeEval = (expression: string, ctx: Record<string, any>): boolean => {
        // 简单的表达式解析器
        // 支持: value, formData, variables, field 等
        const fn = new Function('value', 'formData', 'variables', 'field', `"use strict"; return (${expression})`);
        return fn(value, formData, variables || {}, field);
      };

      const result = safeEval(rule.expression, { value, formData, variables, field });

      if (!result) {
        return {
          fieldId: field.id,
          fieldName: field.label,
          message: rule.message || `${field.label}验证失败`,
          ruleType: 'custom',
        };
      }
    } catch (e) {
      this.logger.error(`自定义验证表达式执行失败: ${rule.expression}`, e);
      return {
        fieldId: field.id,
        fieldName: field.label,
        message: rule.message || `${field.label}验证表达式执行错误`,
        ruleType: 'custom',
      };
    }

    return null;
  }

  /**
   * 字段类型验证
   */
  private validateFieldType(context: FieldValidationContext): ValidationError | null {
    const { value, field } = context;

    switch (field.type) {
      case FormFieldType.STRING:
        if (typeof value !== 'string') {
          return this.createTypeError(field, '字符串');
        }
        break;

      case FormFieldType.NUMBER:
        if (typeof value !== 'number' || isNaN(value)) {
          return this.createTypeError(field, '数字');
        }
        break;

      case FormFieldType.INTEGER:
        if (!Number.isInteger(value)) {
          return this.createTypeError(field, '整数');
        }
        break;

      case FormFieldType.BOOLEAN:
        if (typeof value !== 'boolean') {
          return this.createTypeError(field, '布尔值');
        }
        break;

      case FormFieldType.DATE:
        if (!this.isValidDate(value)) {
          return this.createTypeError(field, '有效日期');
        }
        break;

      case FormFieldType.DATETIME:
        if (!this.isValidDateTime(value)) {
          return this.createTypeError(field, '有效日期时间');
        }
        break;

      case FormFieldType.ENUM:
        if (field.options && !field.options.some((opt) => opt.value === value)) {
          return {
            fieldId: field.id,
            fieldName: field.label,
            message: `${field.label}的值不在有效选项中`,
            ruleType: 'type',
          };
        }
        break;

      case FormFieldType.ARRAY:
        if (!Array.isArray(value)) {
          return this.createTypeError(field, '数组');
        }
        break;

      case FormFieldType.OBJECT:
        if (typeof value !== 'object' || Array.isArray(value)) {
          return this.createTypeError(field, '对象');
        }
        break;

      case FormFieldType.FILE:
        if (!this.isValidFile(value)) {
          return this.createTypeError(field, '有效文件');
        }
        break;
    }

    return null;
  }

  /**
   * 创建类型错误
   */
  private createTypeError(field: FormFieldDefinition, expectedType: string): ValidationError {
    return {
      fieldId: field.id,
      fieldName: field.label,
      message: `${field.label}必须是${expectedType}类型`,
      ruleType: 'type',
    };
  }

  /**
   * 获取值的长度
   */
  private getValueLength(value: any): number | null {
    if (typeof value === 'string') {
      return value.length;
    }
    if (Array.isArray(value)) {
      return value.length;
    }
    return null;
  }

  /**
   * 验证日期格式
   */
  private isValidDate(value: any): boolean {
    if (value instanceof Date) {
      return !isNaN(value.getTime());
    }
    if (typeof value === 'string') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(value)) {
        const date = new Date(value);
        return !isNaN(date.getTime());
      }
    }
    return false;
  }

  /**
   * 验证日期时间格式
   */
  private isValidDateTime(value: any): boolean {
    if (value instanceof Date) {
      return !isNaN(value.getTime());
    }
    if (typeof value === 'string') {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }
    return false;
  }

  /**
   * 验证文件对象
   */
  private isValidFile(value: any): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }
    // 检查必要的文件属性
    return !!(value.name && (value.url || value.path || value.content));
  }

  /**
   * 验证单个字段值
   * @param formId 表单ID
   * @param fieldId 字段ID
   * @param value 字段值
   * @param data 完整表单数据
   * @param variables 上下文变量
   */
  async validateSingleField(
    formId: string,
    fieldId: string,
    value: any,
    data?: Record<string, any>,
    variables?: Record<string, any>,
  ): Promise<ValidationResult> {
    const form = await this.formService.findById(formId);
    const formDefinition = form.formDefinition as FormDefinition;
    const field = formDefinition.fields.find((f: FormFieldDefinition) => f.id === fieldId);

    if (!field) {
      return {
        valid: false,
        errors: [
          {
            fieldId,
            fieldName: fieldId,
            message: `字段不存在: ${fieldId}`,
            ruleType: 'unknown',
          },
        ],
      };
    }

    const fieldData = { ...data, [fieldId]: value };
    const errors = this.validateField(field, fieldData, formDefinition.fields, variables);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 将表单定义转换为JSON Schema
   * @param formDefinition 表单定义
   */
  toJsonSchema(formDefinition: FormDefinition): Record<string, any> {
    const schema: Record<string, any> = {
      type: 'object',
      properties: {},
      required: [],
    };

    for (const field of formDefinition.fields || []) {
      const fieldSchema = this.fieldToJsonSchema(field);
      schema.properties[field.id] = fieldSchema;

      // 检查是否必填
      const hasRequired = (field.validation || []).some((r) => r.type === 'required');
      if (hasRequired) {
        schema.required.push(field.id);
      }
    }

    return schema;
  }

  /**
   * 将字段定义转换为JSON Schema
   */
  private fieldToJsonSchema(field: FormFieldDefinition): Record<string, any> {
    const schema: Record<string, any> = {};

    switch (field.type) {
      case FormFieldType.STRING:
        schema.type = 'string';
        break;

      case FormFieldType.NUMBER:
        schema.type = 'number';
        break;

      case FormFieldType.INTEGER:
        schema.type = 'integer';
        break;

      case FormFieldType.BOOLEAN:
        schema.type = 'boolean';
        break;

      case FormFieldType.DATE:
      case FormFieldType.DATETIME:
        schema.type = 'string';
        schema.format = field.type === FormFieldType.DATE ? 'date' : 'date-time';
        break;

      case FormFieldType.ENUM:
        schema.type = 'string';
        schema.enum = (field.options || []).map((opt) => opt.value);
        break;

      case FormFieldType.ARRAY:
        schema.type = 'array';
        if (field.fields && field.fields.length > 0) {
          schema.items = field.fields.length === 1 
            ? this.fieldToJsonSchema(field.fields[0])
            : {
                type: 'object',
                properties: Object.fromEntries(
                  field.fields.map((f) => [f.id, this.fieldToJsonSchema(f)])
                ),
              };
        }
        break;

      case FormFieldType.OBJECT:
        schema.type = 'object';
        if (field.fields && field.fields.length > 0) {
          schema.properties = Object.fromEntries(
            field.fields.map((f) => [f.id, this.fieldToJsonSchema(f)])
          );
        }
        break;

      default:
        schema.type = 'string';
    }

    // 添加验证规则
    for (const rule of field.validation || []) {
      switch (rule.type) {
        case 'minLength':
          schema.minLength = Number(rule.value);
          break;
        case 'maxLength':
          schema.maxLength = Number(rule.value);
          break;
        case 'min':
          schema.minimum = Number(rule.value);
          break;
        case 'max':
          schema.maximum = Number(rule.value);
          break;
        case 'pattern':
          schema.pattern = String(rule.value);
          break;
      }
    }

    // 添加描述
    if (field.label) {
      schema.title = field.label;
    }
    if (field.placeholder) {
      schema.description = field.placeholder;
    }
    if (field.defaultValue !== undefined) {
      schema.default = field.defaultValue;
    }

    return schema;
  }
}
