/**
 * FormValidationService 单元测试
 */
import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Form } from '../entities/form.entity';
import {
  FormDefinition,
  FormFieldDefinition,
  FormFieldType,
  FieldValidationRule,
} from '../interfaces/form-validation.interface';
import { FormValidationService } from './form-validation.service';
import { FormService } from './form.service';

describe('FormValidationService', () => {
  let service: FormValidationService;
  let formService: FormService;

  const mockForm: Form = {
    id: 'form-123',
    formKey: 'test_form',
    name: '测试表单',
    description: '测试表单描述',
    version: 1,
    formDefinition: {
      fields: [
        {
          id: 'name',
          name: 'name',
          label: '姓名',
          type: FormFieldType.STRING,
          validation: [{ type: 'required', message: '姓名是必填项' }],
        },
        {
          id: 'age',
          name: 'age',
          label: '年龄',
          type: FormFieldType.NUMBER,
          validation: [
            { type: 'min', value: 0, message: '年龄不能小于0' },
            { type: 'max', value: 150, message: '年龄不能大于150' },
          ],
        },
        {
          id: 'email',
          name: 'email',
          label: '邮箱',
          type: FormFieldType.STRING,
          validation: [{ type: 'email', message: '请输入有效的邮箱地址' }],
        },
      ],
    },
    deploymentId: null,
    tenantId: null,
    resourceName: null,
    isSystem: false,
    createTime: new Date(),
    updateTime: new Date(),
  };

  beforeEach(async () => {
    const mockFormService = {
      findById: vi.fn(),
      findByFormKey: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormValidationService,
        {
          provide: FormService,
          useValue: mockFormService,
        },
      ],
    }).compile();

    service = module.get<FormValidationService>(FormValidationService);
    formService = module.get<FormService>(FormService);
  });

  // ==================== validateFormById 测试 ====================

  describe('validateFormById', () => {
    it('应该根据表单ID验证表单数据', async () => {
      vi.mocked(formService.findById).mockResolvedValue(mockForm);

      const data = { name: '张三', age: 25, email: 'test@example.com' };
      const result = await service.validateFormById('form-123', data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该返回验证错误', async () => {
      vi.mocked(formService.findById).mockResolvedValue(mockForm);

      const data = { name: '', age: -5, email: 'invalid-email' };
      const result = await service.validateFormById('form-123', data);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该传递上下文变量', async () => {
      vi.mocked(formService.findById).mockResolvedValue(mockForm);

      const data = { name: '张三' };
      const variables = { userRole: 'admin' };

      await service.validateFormById('form-123', data, variables);

      expect(formService.findById).toHaveBeenCalledWith('form-123');
    });
  });

  // ==================== validateFormByKey 测试 ====================

  describe('validateFormByKey', () => {
    it('应该根据表单键验证表单数据', async () => {
      vi.mocked(formService.findByFormKey).mockResolvedValue(mockForm);

      const data = { name: '张三', age: 25 };
      const result = await service.validateFormByKey('test_form', data);

      expect(formService.findByFormKey).toHaveBeenCalledWith('test_form', undefined);
      expect(result.valid).toBe(true);
    });

    it('应该支持租户ID过滤', async () => {
      vi.mocked(formService.findByFormKey).mockResolvedValue(mockForm);

      const data = { name: '张三' };
      await service.validateFormByKey('test_form', data, {}, 'tenant1');

      expect(formService.findByFormKey).toHaveBeenCalledWith('test_form', 'tenant1');
    });
  });

  // ==================== validateFormDefinition 测试 ====================

  describe('validateFormDefinition', () => {
    it('应该验证有效的表单数据', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'username',
            name: 'username',
            label: '用户名',
            type: FormFieldType.STRING,
            validation: [{ type: 'required', message: '用户名必填' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { username: 'test' });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测必填字段缺失', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'username',
            name: 'username',
            label: '用户名',
            type: FormFieldType.STRING,
            validation: [{ type: 'required', message: '用户名必填' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, {});

      expect(result.valid).toBe(false);
      expect(result.errors[0].ruleType).toBe('required');
    });

    it('应该处理空字段列表', () => {
      const formDefinition: FormDefinition = {
        fields: [],
      };

      const result = service.validateFormDefinition(formDefinition, { any: 'data' });

      expect(result.valid).toBe(true);
    });

    it('应该跳过隐藏字段验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'hiddenField',
            name: 'hiddenField',
            label: '隐藏字段',
            type: FormFieldType.STRING,
            hidden: true,
            validation: [{ type: 'required', message: '必填' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, {});

      expect(result.valid).toBe(true);
    });

    it('应该跳过禁用字段验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'disabledField',
            name: 'disabledField',
            label: '禁用字段',
            type: FormFieldType.STRING,
            disabled: true,
            validation: [{ type: 'required', message: '必填' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, {});

      expect(result.valid).toBe(true);
    });
  });

  // ==================== 必填验证测试 ====================

  describe('required validation', () => {
    const createField = (validation: FieldValidationRule[]): FormFieldDefinition => ({
      id: 'testField',
      name: 'testField',
      label: '测试字段',
      type: FormFieldType.STRING,
      validation,
    });

    it('应该检测空字符串', () => {
      const field = createField([{ type: 'required', message: '必填' }]);
      const formDefinition: FormDefinition = { fields: [field] };

      const result = service.validateFormDefinition(formDefinition, { testField: '' });

      expect(result.valid).toBe(false);
      expect(result.errors[0].ruleType).toBe('required');
    });

    it('应该检测null值', () => {
      const field = createField([{ type: 'required', message: '必填' }]);
      const formDefinition: FormDefinition = { fields: [field] };

      const result = service.validateFormDefinition(formDefinition, { testField: null });

      expect(result.valid).toBe(false);
    });

    it('应该检测undefined值', () => {
      const field = createField([{ type: 'required', message: '必填' }]);
      const formDefinition: FormDefinition = { fields: [field] };

      const result = service.validateFormDefinition(formDefinition, {});

      expect(result.valid).toBe(false);
    });

    it('应该检测空数组', () => {
      const field: FormFieldDefinition = {
        id: 'testField',
        name: 'testField',
        label: '测试字段',
        type: FormFieldType.ARRAY,
        validation: [{ type: 'required', message: '必填' }],
      };
      const formDefinition: FormDefinition = { fields: [field] };

      const result = service.validateFormDefinition(formDefinition, { testField: [] });

      expect(result.valid).toBe(false);
    });

    it('非空值应该通过验证', () => {
      const field = createField([{ type: 'required', message: '必填' }]);
      const formDefinition: FormDefinition = { fields: [field] };

      const result = service.validateFormDefinition(formDefinition, { testField: 'value' });

      expect(result.valid).toBe(true);
    });
  });

  // ==================== 最小值验证测试 ====================

  describe('min validation', () => {
    it('值小于最小值应该返回错误', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'amount',
            name: 'amount',
            label: '金额',
            type: FormFieldType.NUMBER,
            validation: [{ type: 'min', value: 10, message: '最小值为10' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { amount: 5 });

      expect(result.valid).toBe(false);
      expect(result.errors[0].ruleType).toBe('min');
    });

    it('值等于最小值应该通过', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'amount',
            name: 'amount',
            label: '金额',
            type: FormFieldType.NUMBER,
            validation: [{ type: 'min', value: 10, message: '最小值为10' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { amount: 10 });

      expect(result.valid).toBe(true);
    });

    it('值大于最小值应该通过', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'amount',
            name: 'amount',
            label: '金额',
            type: FormFieldType.NUMBER,
            validation: [{ type: 'min', value: 10, message: '最小值为10' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { amount: 15 });

      expect(result.valid).toBe(true);
    });

    it('非数字值应该跳过验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'amount',
            name: 'amount',
            label: '金额',
            type: FormFieldType.STRING,
            validation: [{ type: 'min', value: 10, message: '最小值为10' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { amount: 'string' });

      expect(result.valid).toBe(true);
    });
  });

  // ==================== 最大值验证测试 ====================

  describe('max validation', () => {
    it('值大于最大值应该返回错误', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'amount',
            name: 'amount',
            label: '金额',
            type: FormFieldType.NUMBER,
            validation: [{ type: 'max', value: 100, message: '最大值为100' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { amount: 150 });

      expect(result.valid).toBe(false);
      expect(result.errors[0].ruleType).toBe('max');
    });

    it('值等于最大值应该通过', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'amount',
            name: 'amount',
            label: '金额',
            type: FormFieldType.NUMBER,
            validation: [{ type: 'max', value: 100, message: '最大值为100' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { amount: 100 });

      expect(result.valid).toBe(true);
    });
  });

  // ==================== 最小长度验证测试 ====================

  describe('minLength validation', () => {
    it('字符串长度不足应该返回错误', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'password',
            name: 'password',
            label: '密码',
            type: FormFieldType.STRING,
            validation: [{ type: 'minLength', value: 6, message: '密码至少6位' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { password: '12345' });

      expect(result.valid).toBe(false);
      expect(result.errors[0].ruleType).toBe('minLength');
    });

    it('数组长度不足应该返回错误', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'tags',
            name: 'tags',
            label: '标签',
            type: FormFieldType.ARRAY,
            validation: [{ type: 'minLength', value: 2, message: '至少选择2个标签' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { tags: ['tag1'] });

      expect(result.valid).toBe(false);
    });

    it('长度满足要求应该通过', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'password',
            name: 'password',
            label: '密码',
            type: FormFieldType.STRING,
            validation: [{ type: 'minLength', value: 6, message: '密码至少6位' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { password: '123456' });

      expect(result.valid).toBe(true);
    });
  });

  // ==================== 最大长度验证测试 ====================

  describe('maxLength validation', () => {
    it('字符串超长应该返回错误', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'username',
            name: 'username',
            label: '用户名',
            type: FormFieldType.STRING,
            validation: [{ type: 'maxLength', value: 10, message: '用户名最多10位' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { username: 'verylongusername' });

      expect(result.valid).toBe(false);
      expect(result.errors[0].ruleType).toBe('maxLength');
    });

    it('数组超长应该返回错误', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'items',
            name: 'items',
            label: '项目',
            type: FormFieldType.ARRAY,
            validation: [{ type: 'maxLength', value: 3, message: '最多3个项目' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { items: [1, 2, 3, 4] });

      expect(result.valid).toBe(false);
    });
  });

  // ==================== 正则表达式验证测试 ====================

  describe('pattern validation', () => {
    it('匹配正则表达式应该通过', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'phone',
            name: 'phone',
            label: '手机号',
            type: FormFieldType.STRING,
            validation: [{ type: 'pattern', value: '^1[3-9]\\d{9}$', message: '手机号格式不正确' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { phone: '13800138000' });

      expect(result.valid).toBe(true);
    });

    it('不匹配正则表达式应该返回错误', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'phone',
            name: 'phone',
            label: '手机号',
            type: FormFieldType.STRING,
            validation: [{ type: 'pattern', value: '^1[3-9]\\d{9}$', message: '手机号格式不正确' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { phone: '12345' });

      expect(result.valid).toBe(false);
      expect(result.errors[0].ruleType).toBe('pattern');
    });

    it('空字符串应该跳过正则验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'phone',
            name: 'phone',
            label: '手机号',
            type: FormFieldType.STRING,
            validation: [{ type: 'pattern', value: '^1[3-9]\\d{9}$', message: '手机号格式不正确' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { phone: '' });

      expect(result.valid).toBe(true);
    });

    it('非字符串值应该跳过正则验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'phone',
            name: 'phone',
            label: '手机号',
            type: FormFieldType.NUMBER,
            validation: [{ type: 'pattern', value: '^1[3-9]\\d{9}$', message: '手机号格式不正确' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { phone: 12345 });

      expect(result.valid).toBe(true);
    });
  });

  // ==================== 邮箱验证测试 ====================

  describe('email validation', () => {
    it('有效邮箱应该通过', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'email',
            name: 'email',
            label: '邮箱',
            type: FormFieldType.STRING,
            validation: [{ type: 'email', message: '邮箱格式不正确' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { email: 'test@example.com' });

      expect(result.valid).toBe(true);
    });

    it('无效邮箱应该返回错误', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'email',
            name: 'email',
            label: '邮箱',
            type: FormFieldType.STRING,
            validation: [{ type: 'email', message: '邮箱格式不正确' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { email: 'invalid-email' });

      expect(result.valid).toBe(false);
      expect(result.errors[0].ruleType).toBe('email');
    });

    it('缺少@符号应该返回错误', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'email',
            name: 'email',
            label: '邮箱',
            type: FormFieldType.STRING,
            validation: [{ type: 'email', message: '邮箱格式不正确' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { email: 'testexample.com' });

      expect(result.valid).toBe(false);
    });
  });

  // ==================== URL验证测试 ====================

  describe('url validation', () => {
    it('有效URL应该通过', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'website',
            name: 'website',
            label: '网站',
            type: FormFieldType.STRING,
            validation: [{ type: 'url', message: 'URL格式不正确' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { website: 'https://example.com' });

      expect(result.valid).toBe(true);
    });

    it('无效URL应该返回错误', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'website',
            name: 'website',
            label: '网站',
            type: FormFieldType.STRING,
            validation: [{ type: 'url', message: 'URL格式不正确' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { website: 'not-a-url' });

      expect(result.valid).toBe(false);
      expect(result.errors[0].ruleType).toBe('url');
    });

    it('HTTP URL应该通过', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'website',
            name: 'website',
            label: '网站',
            type: FormFieldType.STRING,
            validation: [{ type: 'url', message: 'URL格式不正确' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { website: 'http://example.com' });

      expect(result.valid).toBe(true);
    });
  });

  // ==================== 自定义验证测试 ====================

  describe('custom validation', () => {
    it('自定义表达式为true应该通过', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'value',
            name: 'value',
            label: '值',
            type: FormFieldType.NUMBER,
            validation: [
              {
                type: 'custom',
                expression: 'value > 0',
                message: '值必须大于0',
              },
            ],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { value: 10 });

      expect(result.valid).toBe(true);
    });

    it('自定义表达式为false应该返回错误', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'value',
            name: 'value',
            label: '值',
            type: FormFieldType.NUMBER,
            validation: [
              {
                type: 'custom',
                expression: 'value > 0',
                message: '值必须大于0',
              },
            ],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { value: -5 });

      expect(result.valid).toBe(false);
      expect(result.errors[0].ruleType).toBe('custom');
    });

    it('应该支持访问formData', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'password',
            name: 'password',
            label: '密码',
            type: FormFieldType.STRING,
          },
          {
            id: 'confirmPassword',
            name: 'confirmPassword',
            label: '确认密码',
            type: FormFieldType.STRING,
            validation: [
              {
                type: 'custom',
                expression: 'value === formData.password',
                message: '两次密码不一致',
              },
            ],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, {
        password: '123456',
        confirmPassword: '654321',
      });

      expect(result.valid).toBe(false);
    });

    it('没有表达式应该跳过验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'value',
            name: 'value',
            label: '值',
            type: FormFieldType.NUMBER,
            validation: [{ type: 'custom', message: '自定义验证' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { value: 10 });

      expect(result.valid).toBe(true);
    });
  });

  // ==================== 字段类型验证测试 ====================

  describe('field type validation', () => {
    it('STRING类型验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'name',
            name: 'name',
            label: '姓名',
            type: FormFieldType.STRING,
          },
        ],
      };

      const validResult = service.validateFormDefinition(formDefinition, { name: '张三' });
      const invalidResult = service.validateFormDefinition(formDefinition, { name: 123 });

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors[0].ruleType).toBe('type');
    });

    it('NUMBER类型验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'age',
            name: 'age',
            label: '年龄',
            type: FormFieldType.NUMBER,
          },
        ],
      };

      const validResult = service.validateFormDefinition(formDefinition, { age: 25 });
      const invalidResult = service.validateFormDefinition(formDefinition, { age: 'twenty-five' });

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });

    it('INTEGER类型验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'count',
            name: 'count',
            label: '数量',
            type: FormFieldType.INTEGER,
          },
        ],
      };

      const validResult = service.validateFormDefinition(formDefinition, { count: 10 });
      const invalidResult = service.validateFormDefinition(formDefinition, { count: 10.5 });

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });

    it('BOOLEAN类型验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'active',
            name: 'active',
            label: '是否激活',
            type: FormFieldType.BOOLEAN,
          },
        ],
      };

      const validResult = service.validateFormDefinition(formDefinition, { active: true });
      const invalidResult = service.validateFormDefinition(formDefinition, { active: 'yes' });

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });

    it('DATE类型验证 - 有效日期字符串', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'birthDate',
            name: 'birthDate',
            label: '出生日期',
            type: FormFieldType.DATE,
          },
        ],
      };

      const validResult = service.validateFormDefinition(formDefinition, { birthDate: '1990-01-15' });
      const invalidResult = service.validateFormDefinition(formDefinition, { birthDate: 'not-a-date' });

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });

    it('DATE类型验证 - Date对象', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'birthDate',
            name: 'birthDate',
            label: '出生日期',
            type: FormFieldType.DATE,
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { birthDate: new Date('1990-01-15') });

      expect(result.valid).toBe(true);
    });

    it('DATETIME类型验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'createdAt',
            name: 'createdAt',
            label: '创建时间',
            type: FormFieldType.DATETIME,
          },
        ],
      };

      const validResult = service.validateFormDefinition(formDefinition, { createdAt: '2026-01-15T10:30:00Z' });
      const invalidResult = service.validateFormDefinition(formDefinition, { createdAt: 'invalid' });

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });

    it('ENUM类型验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'status',
            name: 'status',
            label: '状态',
            type: FormFieldType.ENUM,
            options: [
              { label: '待处理', value: 'pending' },
              { label: '已完成', value: 'completed' },
            ],
          },
        ],
      };

      const validResult = service.validateFormDefinition(formDefinition, { status: 'pending' });
      const invalidResult = service.validateFormDefinition(formDefinition, { status: 'unknown' });

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });

    it('ARRAY类型验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'tags',
            name: 'tags',
            label: '标签',
            type: FormFieldType.ARRAY,
          },
        ],
      };

      const validResult = service.validateFormDefinition(formDefinition, { tags: ['tag1', 'tag2'] });
      const invalidResult = service.validateFormDefinition(formDefinition, { tags: 'not-array' });

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });

    it('OBJECT类型验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'metadata',
            name: 'metadata',
            label: '元数据',
            type: FormFieldType.OBJECT,
          },
        ],
      };

      const validResult = service.validateFormDefinition(formDefinition, { metadata: { key: 'value' } });
      const invalidResult = service.validateFormDefinition(formDefinition, { metadata: [1, 2, 3] });

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });

    it('FILE类型验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'attachment',
            name: 'attachment',
            label: '附件',
            type: FormFieldType.FILE,
          },
        ],
      };

      const validResult = service.validateFormDefinition(formDefinition, {
        attachment: { name: 'file.pdf', url: '/files/file.pdf' },
      });
      const invalidResult = service.validateFormDefinition(formDefinition, { attachment: 'not-a-file' });

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });
  });

  // ==================== 嵌套字段验证测试 ====================

  describe('nested field validation', () => {
    it('应该验证OBJECT类型的嵌套字段', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'address',
            name: 'address',
            label: '地址',
            type: FormFieldType.OBJECT,
            fields: [
              {
                id: 'city',
                name: 'city',
                label: '城市',
                type: FormFieldType.STRING,
                validation: [{ type: 'required', message: '城市必填' }],
              },
              {
                id: 'zipCode',
                name: 'zipCode',
                label: '邮编',
                type: FormFieldType.STRING,
                validation: [{ type: 'pattern', value: '^\\d{6}$', message: '邮编格式不正确' }],
              },
            ],
          },
        ],
      };

      const validResult = service.validateFormDefinition(formDefinition, {
        address: { city: '北京', zipCode: '100000' },
      });

      const invalidResult = service.validateFormDefinition(formDefinition, {
        address: { city: '', zipCode: 'invalid' },
      });

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors[0].fieldId).toBe('address.city');
    });

    it('应该验证ARRAY类型的嵌套字段', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'contacts',
            name: 'contacts',
            label: '联系人',
            type: FormFieldType.ARRAY,
            fields: [
              {
                id: 'name',
                name: 'name',
                label: '姓名',
                type: FormFieldType.STRING,
                validation: [{ type: 'required', message: '姓名必填' }],
              },
              {
                id: 'phone',
                name: 'phone',
                label: '电话',
                type: FormFieldType.STRING,
                validation: [{ type: 'required', message: '电话必填' }],
              },
            ],
          },
        ],
      };

      const validResult = service.validateFormDefinition(formDefinition, {
        contacts: [
          { name: '张三', phone: '13800138000' },
          { name: '李四', phone: '13900139000' },
        ],
      });

      const invalidResult = service.validateFormDefinition(formDefinition, {
        contacts: [
          { name: '张三', phone: '' },
          { name: '', phone: '13900139000' },
        ],
      });

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors[0].fieldId).toContain('contacts[0]');
    });
  });

  // ==================== validateSingleField 测试 ====================

  describe('validateSingleField', () => {
    it('应该验证单个字段', async () => {
      vi.mocked(formService.findById).mockResolvedValue(mockForm);

      const result = await service.validateSingleField('form-123', 'name', '张三');

      expect(result.valid).toBe(true);
    });

    it('字段不存在应该返回错误', async () => {
      vi.mocked(formService.findById).mockResolvedValue(mockForm);

      const result = await service.validateSingleField('form-123', 'nonexistent', 'value');

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('字段不存在');
    });

    it('应该合并传入的数据进行验证', async () => {
      vi.mocked(formService.findById).mockResolvedValue(mockForm);

      const result = await service.validateSingleField(
        'form-123',
        'name',
        '张三',
        { age: 25 },
      );

      expect(formService.findById).toHaveBeenCalledWith('form-123');
    });
  });

  // ==================== toJsonSchema 测试 ====================

  describe('toJsonSchema', () => {
    it('应该将表单定义转换为JSON Schema', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'name',
            name: 'name',
            label: '姓名',
            type: FormFieldType.STRING,
            validation: [{ type: 'required', message: '必填' }],
          },
          {
            id: 'age',
            name: 'age',
            label: '年龄',
            type: FormFieldType.NUMBER,
          },
        ],
      };

      const schema = service.toJsonSchema(formDefinition);

      expect(schema.type).toBe('object');
      expect(schema.properties.name).toBeDefined();
      expect(schema.properties.age).toBeDefined();
      expect(schema.required).toContain('name');
      expect(schema.required).not.toContain('age');
    });

    it('应该正确转换各种字段类型', () => {
      const formDefinition: FormDefinition = {
        fields: [
          { id: 'str', name: 'str', label: '字符串', type: FormFieldType.STRING },
          { id: 'num', name: 'num', label: '数字', type: FormFieldType.NUMBER },
          { id: 'int', name: 'int', label: '整数', type: FormFieldType.INTEGER },
          { id: 'bool', name: 'bool', label: '布尔', type: FormFieldType.BOOLEAN },
          { id: 'date', name: 'date', label: '日期', type: FormFieldType.DATE },
          { id: 'datetime', name: 'datetime', label: '日期时间', type: FormFieldType.DATETIME },
        ],
      };

      const schema = service.toJsonSchema(formDefinition);

      expect(schema.properties.str.type).toBe('string');
      expect(schema.properties.num.type).toBe('number');
      expect(schema.properties.int.type).toBe('integer');
      expect(schema.properties.bool.type).toBe('boolean');
      expect(schema.properties.date.format).toBe('date');
      expect(schema.properties.datetime.format).toBe('date-time');
    });

    it('应该包含验证规则', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'password',
            name: 'password',
            label: '密码',
            type: FormFieldType.STRING,
            validation: [
              { type: 'minLength', value: 6, message: '' },
              { type: 'maxLength', value: 20, message: '' },
              { type: 'pattern', value: '^[a-zA-Z0-9]+$', message: '' },
            ],
          },
          {
            id: 'amount',
            name: 'amount',
            label: '金额',
            type: FormFieldType.NUMBER,
            validation: [
              { type: 'min', value: 0, message: '' },
              { type: 'max', value: 1000, message: '' },
            ],
          },
        ],
      };

      const schema = service.toJsonSchema(formDefinition);

      expect(schema.properties.password.minLength).toBe(6);
      expect(schema.properties.password.maxLength).toBe(20);
      expect(schema.properties.password.pattern).toBe('^[a-zA-Z0-9]+$');
      expect(schema.properties.amount.minimum).toBe(0);
      expect(schema.properties.amount.maximum).toBe(1000);
    });

    it('应该包含字段元信息', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'name',
            name: 'name',
            label: '姓名',
            type: FormFieldType.STRING,
            placeholder: '请输入姓名',
            defaultValue: '默认姓名',
          },
        ],
      };

      const schema = service.toJsonSchema(formDefinition);

      expect(schema.properties.name.title).toBe('姓名');
      expect(schema.properties.name.description).toBe('请输入姓名');
      expect(schema.properties.name.default).toBe('默认姓名');
    });

    it('应该转换ENUM类型', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'status',
            name: 'status',
            label: '状态',
            type: FormFieldType.ENUM,
            options: [
              { label: '待处理', value: 'pending' },
              { label: '已完成', value: 'completed' },
            ],
          },
        ],
      };

      const schema = service.toJsonSchema(formDefinition);

      expect(schema.properties.status.type).toBe('string');
      expect(schema.properties.status.enum).toEqual(['pending', 'completed']);
    });

    it('应该转换嵌套OBJECT类型', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'address',
            name: 'address',
            label: '地址',
            type: FormFieldType.OBJECT,
            fields: [
              { id: 'city', name: 'city', label: '城市', type: FormFieldType.STRING },
              { id: 'zipCode', name: 'zipCode', label: '邮编', type: FormFieldType.STRING },
            ],
          },
        ],
      };

      const schema = service.toJsonSchema(formDefinition);

      expect(schema.properties.address.type).toBe('object');
      expect(schema.properties.address.properties.city).toBeDefined();
      expect(schema.properties.address.properties.zipCode).toBeDefined();
    });

    it('应该转换ARRAY类型', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'tags',
            name: 'tags',
            label: '标签',
            type: FormFieldType.ARRAY,
            fields: [
              { id: 'name', name: 'name', label: '标签名', type: FormFieldType.STRING },
            ],
          },
        ],
      };

      const schema = service.toJsonSchema(formDefinition);

      expect(schema.properties.tags.type).toBe('array');
      expect(schema.properties.tags.items).toBeDefined();
    });
  });

  // ==================== 边界情况测试 ====================

  describe('edge cases', () => {
    it('空值应该跳过类型验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'optional',
            name: 'optional',
            label: '可选字段',
            type: FormFieldType.NUMBER,
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { optional: null });

      expect(result.valid).toBe(true);
    });

    it('空字符串应该跳过类型验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'optional',
            name: 'optional',
            label: '可选字段',
            type: FormFieldType.NUMBER,
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { optional: '' });

      expect(result.valid).toBe(true);
    });

    it('必填验证失败后应该跳过其他验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'field',
            name: 'field',
            label: '字段',
            type: FormFieldType.NUMBER,
            validation: [
              { type: 'required', message: '必填' },
              { type: 'min', value: 10, message: '最小值10' },
            ],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { field: null });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleType).toBe('required');
    });

    it('NaN值应该跳过数值验证', () => {
      const formDefinition: FormDefinition = {
        fields: [
          {
            id: 'value',
            name: 'value',
            label: '值',
            type: FormFieldType.NUMBER,
            validation: [{ type: 'min', value: 0, message: '最小值0' }],
          },
        ],
      };

      const result = service.validateFormDefinition(formDefinition, { value: NaN });

      // NaN不是有效数字，类型验证会失败
      expect(result.valid).toBe(false);
    });
  });
});
