import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateFormDto } from '../dto/create-form.dto';
import { ValidateFormDto, ValidateSingleFieldDto } from '../dto/form-validation.dto';
import { QueryFormDto } from '../dto/query-form.dto';
import { UpdateFormDto } from '../dto/update-form.dto';
import { FormValidationService } from '../services/form-validation.service';
import { FormService } from '../services/form.service';
import { FormController } from './form.controller';

describe('FormController', () => {
  let controller: FormController;
  let formService: FormService;
  let formValidationService: FormValidationService;

  const mockFormService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    findByFormKey: vi.fn(),
    getLatestVersion: vi.fn(),
    findByDeploymentId: vi.fn(),
    update: vi.fn(),
    updateFormDefinition: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };

  const mockFormValidationService = {
    validateFormById: vi.fn(),
    validateFormByKey: vi.fn(),
    validateSingleField: vi.fn(),
    toJsonSchema: vi.fn(),
  };

  const mockForm = {
    id: 'form-1',
    formKey: 'test-form',
    name: 'Test Form',
    formDefinition: {
      fields: [
        { id: 'field1', type: 'text', label: 'Name', required: true },
      ],
    },
    version: 1,
    tenantId: 'tenant-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FormController],
      providers: [
        {
          provide: FormService,
          useValue: mockFormService,
        },
        {
          provide: FormValidationService,
          useValue: mockFormValidationService,
        },
      ],
    }).compile();

    controller = module.get<FormController>(FormController);
    formService = module.get<FormService>(FormService);
    formValidationService = module.get<FormValidationService>(FormValidationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a form successfully', async () => {
      const dto: CreateFormDto = {
        formKey: 'test-form',
        name: 'Test Form',
        formDefinition: { fields: [] },
      };

      mockFormService.create.mockResolvedValue(mockForm);

      const result = await controller.create(dto);

      expect(formService.create).toHaveBeenCalledWith(
        dto.formKey,
        dto.name,
        dto.formDefinition,
        dto.description,
        dto.version,
        dto.deploymentId,
        dto.tenantId,
        dto.resourceName,
        dto.isSystem,
      );
      expect(result.code).toBe(201);
      expect(result.data).toEqual(mockForm);
    });

    it('should throw error when creation fails', async () => {
      const dto: CreateFormDto = {
        formKey: 'test-form',
        name: 'Test Form',
        formDefinition: { fields: [] },
      };

      mockFormService.create.mockRejectedValue(new Error('Creation failed'));

      await expect(controller.create(dto)).rejects.toThrow('Creation failed');
    });
  });

  describe('findAll', () => {
    it('should return a list of forms', async () => {
      const query: QueryFormDto = { page: 1, pageSize: 10 };

      mockFormService.findAll.mockResolvedValue({
        data: [mockForm],
        total: 1,
      });

      const result = await controller.findAll(query);

      expect(formService.findAll).toHaveBeenCalledWith(1, 10, undefined, undefined);
      expect(result.code).toBe(200);
      expect(result.data).toEqual([mockForm]);
    });

    it('should filter forms by formKey and tenantId', async () => {
      const query: QueryFormDto = {
        page: 1,
        pageSize: 10,
        formKey: 'test-form',
        tenantId: 'tenant-1',
      };

      mockFormService.findAll.mockResolvedValue({
        data: [mockForm],
        total: 1,
      });

      const result = await controller.findAll(query);

      expect(formService.findAll).toHaveBeenCalledWith(1, 10, 'test-form', 'tenant-1');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return a form by id', async () => {
      mockFormService.findById.mockResolvedValue(mockForm);

      const result = await controller.findById('form-1');

      expect(formService.findById).toHaveBeenCalledWith('form-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockForm);
    });

    it('should throw error when form not found', async () => {
      mockFormService.findById.mockRejectedValue(new Error('Form not found'));

      await expect(controller.findById('non-existent')).rejects.toThrow('Form not found');
    });
  });

  describe('findByFormKey', () => {
    it('should return a form by formKey', async () => {
      mockFormService.findByFormKey.mockResolvedValue(mockForm);

      const result = await controller.findByFormKey('test-form');

      expect(formService.findByFormKey).toHaveBeenCalledWith('test-form', undefined);
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockForm);
    });

    it('should return a form by formKey with tenantId', async () => {
      mockFormService.findByFormKey.mockResolvedValue(mockForm);

      const result = await controller.findByFormKey('test-form', 'tenant-1');

      expect(formService.findByFormKey).toHaveBeenCalledWith('test-form', 'tenant-1');
      expect(result.data).toEqual(mockForm);
    });
  });

  describe('getLatestVersion', () => {
    it('should return the latest version of a form', async () => {
      mockFormService.getLatestVersion.mockResolvedValue({
        ...mockForm,
        version: 3,
      });

      const result = await controller.getLatestVersion('test-form');

      expect(formService.getLatestVersion).toHaveBeenCalledWith('test-form', undefined);
      expect(result.data.version).toBe(3);
    });

    it('should return the latest version with tenantId', async () => {
      mockFormService.getLatestVersion.mockResolvedValue({
        ...mockForm,
        version: 3,
      });

      const result = await controller.getLatestVersion('test-form', 'tenant-1');

      expect(formService.getLatestVersion).toHaveBeenCalledWith('test-form', 'tenant-1');
    });
  });

  describe('findByDeploymentId', () => {
    it('should return forms by deployment id', async () => {
      mockFormService.findByDeploymentId.mockResolvedValue([mockForm]);

      const result = await controller.findByDeploymentId('deployment-1');

      expect(formService.findByDeploymentId).toHaveBeenCalledWith('deployment-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual([mockForm]);
    });
  });

  describe('update', () => {
    it('should update a form successfully', async () => {
      const dto: UpdateFormDto = { name: 'Updated Form' };

      mockFormService.update.mockResolvedValue({
        ...mockForm,
        name: 'Updated Form',
      });

      const result = await controller.update('form-1', dto);

      expect(formService.update).toHaveBeenCalledWith('form-1', dto);
      expect(result.code).toBe(200);
      expect(result.data.name).toBe('Updated Form');
    });

    it('should throw error when form not found', async () => {
      const dto: UpdateFormDto = { name: 'Updated Form' };

      mockFormService.update.mockRejectedValue(new Error('Form not found'));

      await expect(controller.update('non-existent', dto)).rejects.toThrow('Form not found');
    });
  });

  describe('updateFormDefinition', () => {
    it('should update form definition successfully', async () => {
      const formDefinition = { fields: [{ id: 'newField', type: 'text' }] };

      mockFormService.updateFormDefinition.mockResolvedValue({
        ...mockForm,
        formDefinition,
      });

      const result = await controller.updateFormDefinition('form-1', formDefinition);

      expect(formService.updateFormDefinition).toHaveBeenCalledWith('form-1', formDefinition);
      expect(result.code).toBe(200);
    });
  });

  describe('delete', () => {
    it('should delete a form successfully', async () => {
      mockFormService.delete.mockResolvedValue(undefined);

      const result = await controller.delete('form-1');

      expect(formService.delete).toHaveBeenCalledWith('form-1');
      expect(result.code).toBe(200);
      expect(result.message).toBe('删除成功');
    });
  });

  describe('deleteMany', () => {
    it('should delete multiple forms successfully', async () => {
      const ids = ['form-1', 'form-2'];

      mockFormService.deleteMany.mockResolvedValue(undefined);

      const result = await controller.deleteMany(ids);

      expect(formService.deleteMany).toHaveBeenCalledWith(ids);
      expect(result.code).toBe(200);
    });
  });

  describe('count', () => {
    it('should return form count', async () => {
      mockFormService.count.mockResolvedValue(5);

      const result = await controller.count();

      expect(formService.count).toHaveBeenCalledWith(undefined, undefined);
      expect(result.code).toBe(200);
      expect(result.data.count).toBe(5);
    });

    it('should return filtered form count', async () => {
      mockFormService.count.mockResolvedValue(2);

      const result = await controller.count('test-form', 'tenant-1');

      expect(formService.count).toHaveBeenCalledWith('test-form', 'tenant-1');
      expect(result.data.count).toBe(2);
    });
  });

  describe('validateForm', () => {
    it('should validate form by id', async () => {
      const dto: ValidateFormDto = {
        formId: 'form-1',
        data: { field1: 'value1' },
      };

      const mockValidationResult = {
        valid: true,
        errors: [],
      };

      mockFormValidationService.validateFormById.mockResolvedValue(mockValidationResult);

      const result = await controller.validateForm(dto);

      expect(formValidationService.validateFormById).toHaveBeenCalledWith(
        'form-1',
        dto.data,
        dto.variables,
      );
      expect(result.valid).toBe(true);
    });

    it('should validate form by key', async () => {
      const dto: ValidateFormDto = {
        formKey: 'test-form',
        data: { field1: 'value1' },
        tenantId: 'tenant-1',
      };

      const mockValidationResult = {
        valid: true,
        errors: [],
      };

      mockFormValidationService.validateFormByKey.mockResolvedValue(mockValidationResult);

      const result = await controller.validateForm(dto);

      expect(formValidationService.validateFormByKey).toHaveBeenCalledWith(
        'test-form',
        dto.data,
        dto.variables,
        'tenant-1',
      );
      expect(result.valid).toBe(true);
    });

    it('should return error when neither formId nor formKey is provided', async () => {
      const dto: ValidateFormDto = {
        data: { field1: 'value1' },
      };

      const result = await controller.validateForm(dto);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('必须提供formId或formKey');
    });
  });

  describe('validateSingleField', () => {
    it('should validate a single field', async () => {
      const dto: ValidateSingleFieldDto = {
        formId: 'form-1',
        fieldId: 'field1',
        value: 'test value',
      };

      const mockValidationResult = {
        valid: true,
        errors: [],
      };

      mockFormValidationService.validateSingleField.mockResolvedValue(mockValidationResult);

      const result = await controller.validateSingleField(dto);

      expect(formValidationService.validateSingleField).toHaveBeenCalledWith(
        'form-1',
        'field1',
        'test value',
        dto.data,
        dto.variables,
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('getJsonSchema', () => {
    it('should return JSON schema for a form', async () => {
      const mockSchema = {
        type: 'object',
        properties: {
          field1: { type: 'string' },
        },
      };

      mockFormService.findById.mockResolvedValue(mockForm);
      mockFormValidationService.toJsonSchema.mockReturnValue(mockSchema);

      const result = await controller.getJsonSchema('form-1');

      expect(formService.findById).toHaveBeenCalledWith('form-1');
      expect(formValidationService.toJsonSchema).toHaveBeenCalledWith(mockForm.formDefinition);
      expect(result.schema).toEqual(mockSchema);
    });
  });

  describe('getJsonSchemaByFormKey', () => {
    it('should return JSON schema by form key', async () => {
      const mockSchema = {
        type: 'object',
        properties: {
          field1: { type: 'string' },
        },
      };

      mockFormService.findByFormKey.mockResolvedValue(mockForm);
      mockFormValidationService.toJsonSchema.mockReturnValue(mockSchema);

      const result = await controller.getJsonSchemaByFormKey('test-form');

      expect(formService.findByFormKey).toHaveBeenCalledWith('test-form', undefined);
      expect(formValidationService.toJsonSchema).toHaveBeenCalledWith(mockForm.formDefinition);
      expect(result.schema).toEqual(mockSchema);
    });

    it('should return JSON schema by form key with tenantId', async () => {
      const mockSchema = {
        type: 'object',
        properties: {
          field1: { type: 'string' },
        },
      };

      mockFormService.findByFormKey.mockResolvedValue(mockForm);
      mockFormValidationService.toJsonSchema.mockReturnValue(mockSchema);

      const result = await controller.getJsonSchemaByFormKey('test-form', 'tenant-1');

      expect(formService.findByFormKey).toHaveBeenCalledWith('test-form', 'tenant-1');
      expect(result.schema).toEqual(mockSchema);
    });
  });
});
