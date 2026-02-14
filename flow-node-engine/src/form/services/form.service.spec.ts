/**
 * FormService 单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { FormService } from './form.service';
import { Form } from '../entities/form.entity';

describe('FormService', () => {
  let service: FormService;
  let formRepository: Repository<Form>;

  const mockForm: Form = {
    id: 'form-123',
    formKey: 'leave_form',
    name: '请假表单',
    description: '员工请假申请表单',
    version: 1,
    formDefinition: {
      fields: [
        { id: 'leaveDays', name: 'leaveDays', label: '请假天数', type: 'number' },
        { id: 'reason', name: 'reason', label: '请假原因', type: 'string' },
      ],
    },
    deploymentId: 'deploy-123',
    tenantId: 'tenant1',
    resourceName: 'leave_form.json',
    isSystem: false,
    createTime: new Date('2026-01-01T00:00:00.000Z'),
    updateTime: new Date('2026-01-01T00:00:00.000Z'),
  };

  const mockSystemForm: Form = {
    ...mockForm,
    id: 'form-sys-123',
    formKey: 'system_form',
    name: '系统表单',
    isSystem: true,
  };

  beforeEach(async () => {
    const mockFormRepository = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      remove: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormService,
        {
          provide: 'FormRepository',
          useValue: mockFormRepository,
        },
      ],
    }).compile();

    service = module.get<FormService>(FormService);
    formRepository = module.get('FormRepository');
  });

  // ==================== 创建表单测试 ====================

  describe('create', () => {
    it('应该成功创建表单', async () => {
      const formDefinition = {
        fields: [
          { id: 'field1', name: 'field1', label: '字段1', type: 'string' },
        ],
      };

      vi.mocked(formRepository.findOne).mockResolvedValue(null);
      vi.mocked(formRepository.create).mockReturnValue(mockForm);
      vi.mocked(formRepository.save).mockResolvedValue(mockForm);

      const result = await service.create(
        'leave_form',
        '请假表单',
        formDefinition,
        '员工请假申请表单',
      );

      expect(formRepository.findOne).toHaveBeenCalled();
      expect(formRepository.create).toHaveBeenCalled();
      expect(formRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockForm);
    });

    it('表单键已存在时应该抛出错误', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValue(mockForm);

      await expect(
        service.create('leave_form', '请假表单', {}),
      ).rejects.toThrow('表单键已存在: leave_form');
    });

    it('应该使用默认值创建表单', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValue(null);
      vi.mocked(formRepository.create).mockImplementation((data) => data as Form);
      vi.mocked(formRepository.save).mockImplementation((form) => Promise.resolve(form as Form));

      await service.create('new_form', '新表单', { fields: [] });

      expect(formRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          isSystem: false,
        }),
      );
    });

    it('应该支持指定版本和租户ID', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValue(null);
      vi.mocked(formRepository.create).mockImplementation((data) => data as Form);
      vi.mocked(formRepository.save).mockImplementation((form) => Promise.resolve(form as Form));

      await service.create(
        'new_form',
        '新表单',
        { fields: [] },
        '描述',
        2, // version
        'deploy-123', // deploymentId
        'tenant1', // tenantId
        'form.json', // resourceName
        true, // isSystem
      );

      expect(formRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 2,
          tenantId: 'tenant1',
          isSystem: true,
          deploymentId: 'deploy-123',
          resourceName: 'form.json',
        }),
      );
    });
  });

  // ==================== 查询表单测试 ====================

  describe('findById', () => {
    it('应该返回指定ID的表单', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValue(mockForm);

      const result = await service.findById('form-123');

      expect(formRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'form-123' },
      });
      expect(result).toEqual(mockForm);
    });

    it('表单不存在时应该抛出NotFoundException', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByFormKey', () => {
    it('应该返回指定表单键的表单', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValue(mockForm);

      const result = await service.findByFormKey('leave_form');

      expect(formRepository.findOne).toHaveBeenCalledWith({
        where: { formKey: 'leave_form' },
      });
      expect(result).toEqual(mockForm);
    });

    it('应该支持租户ID过滤', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValue(mockForm);

      await service.findByFormKey('leave_form', 'tenant1');

      expect(formRepository.findOne).toHaveBeenCalledWith({
        where: { formKey: 'leave_form', tenantId: 'tenant1' },
      });
    });

    it('表单不存在时应该抛出NotFoundException', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValue(null);

      await expect(service.findByFormKey('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('应该返回分页表单列表', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockForm], 1]),
      };
      vi.mocked(formRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该支持表单键过滤', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockForm], 1]),
      };
      vi.mocked(formRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder as any);

      await service.findAll(1, 10, 'leave_form');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('f.formKey = :formKey', {
        formKey: 'leave_form',
      });
    });

    it('应该支持租户ID过滤', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockForm], 1]),
      };
      vi.mocked(formRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder as any);

      await service.findAll(1, 10, undefined, 'tenant1');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('f.tenantId = :tenantId', {
        tenantId: 'tenant1',
      });
    });

    it('应该正确计算分页偏移量', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
      };
      vi.mocked(formRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder as any);

      await service.findAll(3, 25);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(50); // (3-1) * 25
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(25);
    });
  });

  describe('findByDeploymentId', () => {
    it('应该返回指定部署ID的表单列表', async () => {
      vi.mocked(formRepository.find).mockResolvedValue([mockForm]);

      const result = await service.findByDeploymentId('deploy-123');

      expect(formRepository.find).toHaveBeenCalledWith({
        where: { deploymentId: 'deploy-123' },
        order: { createTime: 'ASC' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getLatestVersion', () => {
    it('应该返回最新版本的表单', async () => {
      const newerForm = { ...mockForm, version: 2 };
      vi.mocked(formRepository.findOne).mockResolvedValue(newerForm);

      const result = await service.getLatestVersion('leave_form');

      expect(formRepository.findOne).toHaveBeenCalledWith({
        where: { formKey: 'leave_form' },
        order: { version: 'DESC' },
      });
      expect(result.version).toBe(2);
    });

    it('应该支持租户ID过滤', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValue(mockForm);

      await service.getLatestVersion('leave_form', 'tenant1');

      expect(formRepository.findOne).toHaveBeenCalledWith({
        where: { formKey: 'leave_form', tenantId: 'tenant1' },
        order: { version: 'DESC' },
      });
    });

    it('表单不存在时应该抛出NotFoundException', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValue(null);

      await expect(service.getLatestVersion('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== 更新表单测试 ====================

  describe('update', () => {
    it('应该成功更新表单', async () => {
      const updates = { name: '更新后的表单名称' };
      const updatedForm = { ...mockForm, ...updates };

      vi.mocked(formRepository.findOne).mockResolvedValueOnce(mockForm);
      vi.mocked(formRepository.save).mockResolvedValue(updatedForm);

      const result = await service.update('form-123', updates);

      expect(result.name).toBe('更新后的表单名称');
    });

    it('更新表单键时应该检查是否已存在', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValueOnce(mockForm);
      vi.mocked(formRepository.findOne).mockResolvedValueOnce({ ...mockForm, id: 'other-form' });

      await expect(
        service.update('form-123', { formKey: 'existing_key' }),
      ).rejects.toThrow('表单键已存在: existing_key');
    });

    it('更新为相同的表单键应该成功', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValueOnce(mockForm);
      vi.mocked(formRepository.save).mockResolvedValue(mockForm);

      const result = await service.update('form-123', { formKey: 'leave_form' });

      expect(result).toEqual(mockForm);
    });

    it('表单不存在时应该抛出NotFoundException', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: '新名称' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateFormDefinition', () => {
    it('应该成功更新表单定义', async () => {
      const newDefinition = {
        fields: [
          { id: 'newField', name: 'newField', label: '新字段', type: 'string' },
        ],
      };
      const updatedForm = { ...mockForm, formDefinition: newDefinition };

      vi.mocked(formRepository.findOne).mockResolvedValue(mockForm);
      vi.mocked(formRepository.save).mockResolvedValue(updatedForm);

      const result = await service.updateFormDefinition('form-123', newDefinition);

      expect(result.formDefinition).toEqual(newDefinition);
    });
  });

  // ==================== 删除表单测试 ====================

  describe('delete', () => {
    it('应该成功删除非系统表单', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValue(mockForm);
      vi.mocked(formRepository.remove).mockResolvedValue(mockForm);

      await service.delete('form-123');

      expect(formRepository.remove).toHaveBeenCalledWith(mockForm);
    });

    it('删除系统表单时应该抛出错误', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValue(mockSystemForm);

      await expect(service.delete('form-sys-123')).rejects.toThrow('系统表单不允许删除');
    });

    it('表单不存在时应该抛出NotFoundException', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteMany', () => {
    it('应该批量删除表单', async () => {
      vi.mocked(formRepository.findOne).mockResolvedValue(mockForm);
      vi.mocked(formRepository.remove).mockResolvedValue(mockForm);

      await service.deleteMany(['form-123', 'form-456']);

      expect(formRepository.remove).toHaveBeenCalledTimes(2);
    });
  });

  // ==================== 统计测试 ====================

  describe('count', () => {
    it('应该返回表单总数', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(10),
      };
      vi.mocked(formRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder as any);

      const result = await service.count();

      expect(result).toBe(10);
    });

    it('应该支持表单键过滤', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(1),
      };
      vi.mocked(formRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder as any);

      await service.count('leave_form');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('f.formKey = :formKey', {
        formKey: 'leave_form',
      });
    });

    it('应该支持租户ID过滤', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(5),
      };
      vi.mocked(formRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder as any);

      await service.count(undefined, 'tenant1');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('f.tenantId = :tenantId', {
        tenantId: 'tenant1',
      });
    });
  });
});
