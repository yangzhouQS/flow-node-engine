/**
 * 表单字段类型枚举
 */
export enum FormFieldType {
  STRING = 'string',
  NUMBER = 'number',
  INTEGER = 'integer',
  BOOLEAN = 'boolean',
  DATE = 'date',
  DATETIME = 'datetime',
  ENUM = 'enum',
  ARRAY = 'array',
  OBJECT = 'object',
  FILE = 'file',
  USER = 'user',
  GROUP = 'group',
  DEPARTMENT = 'department',
}

/**
 * 字段验证规则
 */
export interface FieldValidationRule {
  /** 规则类型 */
  type: 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'email' | 'url' | 'custom';
  /** 规则值（如最小值、最大值、正则表达式等） */
  value?: string | number | any;
  /** 自定义验证表达式 */
  expression?: string;
  /** 错误消息 */
  message: string;
}

/**
 * 表单字段定义
 */
export interface FormFieldDefinition {
  /** 字段ID */
  id: string;
  /** 字段名称 */
  name: string;
  /** 字段标签 */
  label: string;
  /** 字段类型 */
  type: FormFieldType;
  /** 字段占位符 */
  placeholder?: string;
  /** 默认值 */
  defaultValue?: any;
  /** 是否只读 */
  readonly?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否隐藏 */
  hidden?: boolean;
  /** 验证规则列表 */
  validation?: FieldValidationRule[];
  /** 枚举选项（当type为enum时） */
  options?: Array<{ label: string; value: any }>;
  /** 子字段定义（当type为object或array时） */
  fields?: FormFieldDefinition[];
  /** 字段配置 */
  config?: Record<string, any>;
}

/**
 * 表单定义
 */
export interface FormDefinition {
  /** 表单版本 */
  version?: string;
  /** 表单字段列表 */
  fields: FormFieldDefinition[];
  /** 表单布局配置 */
  layout?: {
    columns?: number;
    labelWidth?: string;
    labelPosition?: 'left' | 'right' | 'top';
  };
  /** 全局验证配置 */
  validation?: {
    /** 验证时机：blur | change | submit */
    trigger?: string;
    /** 是否显示错误消息 */
    showErrorMessage?: boolean;
  };
}

/**
 * 验证错误
 */
export interface ValidationError {
  /** 字段ID */
  fieldId: string;
  /** 字段名称 */
  fieldName: string;
  /** 错误消息 */
  message: string;
  /** 规则类型 */
  ruleType: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否验证通过 */
  valid: boolean;
  /** 验证错误列表 */
  errors: ValidationError[];
}

/**
 * 表单数据提交
 */
export interface FormDataSubmit {
  /** 表单ID */
  formId?: string;
  /** 表单键 */
  formKey?: string;
  /** 表单数据 */
  data: Record<string, any>;
  /** 任务ID（可选） */
  taskId?: string;
  /** 流程实例ID（可选） */
  processInstanceId?: string;
}

/**
 * 字段验证上下文
 */
export interface FieldValidationContext {
  /** 当前字段值 */
  value: any;
  /** 字段定义 */
  field: FormFieldDefinition;
  /** 完整表单数据 */
  formData: Record<string, any>;
  /** 所有字段定义 */
  allFields: FormFieldDefinition[];
  /** 上下文变量（流程变量等） */
  variables?: Record<string, any>;
}
