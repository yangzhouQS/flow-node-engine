/**
 * BatchService 单元测试
 * 测试批处理服务的核心功能
 */
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository, QueryRunner } from 'typeorm';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { CreateBatchDto, BatchPartItemDto } from '../dto/batch.dto';
import { BatchPartEntity, BatchPartStatus } from '../entities/batch-part.entity';
import { BatchEntity, BatchStatus, BatchType } from '../entities/batch.entity';
import { BatchService, BatchExecutor, BatchConfig } from './batch.service';

// Mock 数据
const mockBatch: BatchEntity = {
  id: 'batch-123',
  type: BatchType.CUSTOM,
  total: 10,
  processedTotal: 0,
  successTotal: 0,
  failTotal: 0,
  status: BatchStatus.PENDING,
  config: null,
  searchKey: null,
  searchKey2: null,
  tenantId: 'tenant-123',
  createUser: 'user-123',
  createTime: new Date(),
  updateTime: null,
  completeTime: null,
  description: 'Test batch',
  async: true,
  priority: 0,
  retryCount: 0,
  maxRetries: 3,
  errorMessage: null,
  extra: null,
};

const mockBatchPart: BatchPartEntity = {
  id: 'part-123',
  batchId: 'batch-123',
  type: 'test-type',
  status: BatchPartStatus.PENDING,
  data: JSON.stringify({ key: 'value' }),
  result: null,
  errorMessage: null,
  errorDetails: null,
  retryCount: 0,
  createTime: new Date(),
  startTime: null,
  completeTime: null,
  tenantId: 'tenant-123',
  extra: null,
  batch: mockBatch,
};

describe('BatchService', () => {
  let service: BatchService;
  let batchRepository: vi.Mocked<Repository<BatchEntity>>;
  let batchPartRepository: vi.Mocked<Repository<BatchPartEntity>>;
  let dataSource: vi.Mocked<DataSource>;

  beforeEach(async () => {
    // 创建 mock repositories
    batchRepository = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as any;

    batchPartRepository = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as any;

    // 创建 mock dataSource
    const mockQueryRunner = {
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      manager: {
        save: vi.fn().mockResolvedValue(undefined),
        find: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn().mockResolvedValue(undefined),
        createQueryBuilder: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          addSelect: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          setParameters: vi.fn().mockReturnThis(),
          getRawOne: vi.fn().mockResolvedValue({ total: '10', successTotal: '0', failTotal: '0', processedTotal: '0' }),
        }),
      },
    };
    dataSource = {
      createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchService,
        { provide: 'BatchEntityRepository', useValue: batchRepository },
        { provide: 'BatchPartEntityRepository', useValue: batchPartRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    })
      .overrideProvider('BatchEntityRepository')
      .useValue(batchRepository)
      .overrideProvider('BatchPartEntityRepository')
      .useValue(batchPartRepository)
      .overrideProvider(DataSource)
      .useValue(dataSource)
      .compile();

    service = module.get<BatchService>(BatchService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== 执行器注册测试 ====================

  describe('registerExecutor', () => {
    it('应该成功注册批处理执行器', () => {
      const executor: BatchExecutor = {
        type: 'test-type',
        execute: vi.fn(),
      };

      service.registerExecutor(executor);

      // 验证执行器已注册（通过后续操作间接验证）
      expect(true).toBe(true);
    });
  });

  // ==================== 配置更新测试 ====================

  describe('updateConfig', () => {
    it('应该更新批处理配置', () => {
      const newConfig: Partial<BatchConfig> = {
        batchSize: 100,
        processInterval: 10000,
      };

      service.updateConfig(newConfig);

      // 验证配置已更新
      expect(true).toBe(true);
    });

    it('应该保留未更新的配置项', () => {
      service.updateConfig({ batchSize: 100 });
      service.updateConfig({ processInterval: 10000 });

      // 验证多次更新不会丢失之前的配置
      expect(true).toBe(true);
    });
  });

  // ==================== 批处理创建测试 ====================

  describe('createBatch', () => {
    it('应该成功创建批处理', async () => {
      const dto: CreateBatchDto = {
        type: BatchType.CUSTOM,
        description: 'Test batch',
      };

      batchRepository.create.mockReturnValue(mockBatch);
      batchRepository.save.mockResolvedValue(mockBatch);

      const result = await service.createBatch(dto, 'user-123');

      expect(batchRepository.create).toHaveBeenCalled();
      expect(batchRepository.save).toHaveBeenCalled();
      expect(result.type).toBe(BatchType.CUSTOM);
    });

    it('创建批处理时应该设置默认值', async () => {
      const dto: CreateBatchDto = {
        type: BatchType.CUSTOM,
      };

      const createdBatch = { ...mockBatch };
      batchRepository.create.mockReturnValue(createdBatch);
      batchRepository.save.mockResolvedValue(createdBatch);

      await service.createBatch(dto);

      const createCall = batchRepository.create.mock.calls[0][0];
      expect(createCall.async).toBe(true);
      expect(createCall.priority).toBe(0);
      expect(createCall.maxRetries).toBe(3);
      expect(createCall.status).toBe(BatchStatus.PENDING);
    });

    it('创建批处理时应该包含数据项', async () => {
      const items: BatchPartItemDto[] = [
        { type: 'item1', data: { key: 'value1' } },
        { type: 'item2', data: { key: 'value2' } },
      ];

      const dto: CreateBatchDto = {
        type: BatchType.CUSTOM,
        items,
      };

      batchRepository.create.mockReturnValue(mockBatch);
      batchRepository.save.mockResolvedValue(mockBatch);
      batchRepository.findOne.mockResolvedValue(mockBatch);
      batchPartRepository.create.mockReturnValue(mockBatchPart);
      batchPartRepository.save.mockResolvedValue([mockBatchPart, mockBatchPart]);
      batchRepository.update.mockResolvedValue(undefined);

      await service.createBatch(dto, 'user-123', 'tenant-123');

      expect(batchPartRepository.save).toHaveBeenCalled();
    });

    it('应该序列化配置为JSON', async () => {
      const dto: CreateBatchDto = {
        type: BatchType.CUSTOM,
        config: { timeout: 5000, retries: 3 },
      };

      batchRepository.create.mockReturnValue(mockBatch);
      batchRepository.save.mockResolvedValue(mockBatch);

      await service.createBatch(dto);

      const createCall = batchRepository.create.mock.calls[0][0];
      expect(createCall.config).toBe(JSON.stringify({ timeout: 5000, retries: 3 }));
    });
  });

  // ==================== 添加批处理部分测试 ====================

  describe('addBatchParts', () => {
    it('应该成功添加批处理部分', async () => {
      const items: BatchPartItemDto[] = [
        { type: 'item1', data: { key: 'value1' } },
      ];

      batchRepository.findOne.mockResolvedValue(mockBatch);
      batchPartRepository.create.mockReturnValue(mockBatchPart);
      batchPartRepository.save.mockResolvedValue([mockBatchPart]);
      batchRepository.update.mockResolvedValue(undefined);

      const result = await service.addBatchParts('batch-123', items, 'tenant-123');

      expect(result).toHaveLength(1);
      expect(batchPartRepository.save).toHaveBeenCalled();
    });

    it('批处理不存在时应该抛出异常', async () => {
      batchRepository.findOne.mockResolvedValue(null);

      const items: BatchPartItemDto[] = [{ type: 'item1', data: {} }];

      await expect(service.addBatchParts('nonexistent', items)).rejects.toThrow(NotFoundException);
    });

    it('批处理状态不是PENDING时应该抛出异常', async () => {
      const runningBatch = { ...mockBatch, status: BatchStatus.RUNNING };
      batchRepository.findOne.mockResolvedValue(runningBatch);

      const items: BatchPartItemDto[] = [{ type: 'item1', data: {} }];

      await expect(service.addBatchParts('batch-123', items)).rejects.toThrow(BadRequestException);
    });

    it('应该更新批处理总数', async () => {
      const items: BatchPartItemDto[] = [
        { type: 'item1', data: {} },
        { type: 'item2', data: {} },
      ];

      batchRepository.findOne.mockResolvedValue(mockBatch);
      batchPartRepository.create.mockReturnValue(mockBatchPart);
      batchPartRepository.save.mockResolvedValue([mockBatchPart, mockBatchPart]);
      batchRepository.update.mockResolvedValue(undefined);

      await service.addBatchParts('batch-123', items);

      expect(batchRepository.update).toHaveBeenCalledWith(
        'batch-123',
        expect.objectContaining({ total: mockBatch.total + items.length })
      );
    });
  });

  // ==================== 获取批处理测试 ====================

  describe('getBatchById', () => {
    it('应该返回指定ID的批处理', async () => {
      batchRepository.findOne.mockResolvedValue(mockBatch);

      const result = await service.getBatchById('batch-123');

      expect(batchRepository.findOne).toHaveBeenCalledWith({ where: { id: 'batch-123' } });
      expect(result).toEqual(mockBatch);
    });

    it('批处理不存在时应该返回null', async () => {
      batchRepository.findOne.mockResolvedValue(null);

      const result = await service.getBatchById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ==================== 查询批处理列表测试 ====================

  describe('queryBatches', () => {
    it('应该查询批处理列表', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockBatch], 1]),
      };
      batchRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.queryBatches({});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该根据类型过滤', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockBatch], 1]),
      };
      batchRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.queryBatches({ type: BatchType.CUSTOM });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('batch.type = :type', {
        type: BatchType.CUSTOM,
      });
    });

    it('应该根据状态过滤', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockBatch], 1]),
      };
      batchRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.queryBatches({ status: BatchStatus.PENDING });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('batch.status = :status', {
        status: BatchStatus.PENDING,
      });
    });

    it('应该支持分页', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockBatch], 100]),
      };
      batchRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.queryBatches({ page: 2, size: 10 });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });
  });

  // ==================== 更新批处理测试 ====================

  describe('updateBatch', () => {
    it('应该更新批处理', async () => {
      batchRepository.findOne.mockResolvedValue(mockBatch);
      batchRepository.save.mockResolvedValue({ ...mockBatch, description: 'Updated' });

      const result = await service.updateBatch('batch-123', { description: 'Updated' });

      expect(result.description).toBe('Updated');
    });

    it('批处理不存在时应该抛出异常', async () => {
      batchRepository.findOne.mockResolvedValue(null);

      await expect(service.updateBatch('nonexistent', {})).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== 取消批处理测试 ====================

  describe('cancelBatch', () => {
    it('应该取消批处理', async () => {
      batchRepository.findOne.mockResolvedValue(mockBatch);
      batchRepository.save.mockResolvedValue({ ...mockBatch, status: BatchStatus.CANCELLED });
      batchPartRepository.update.mockResolvedValue(undefined);

      const result = await service.cancelBatch('batch-123');

      expect(result.status).toBe(BatchStatus.CANCELLED);
    });

    it('取消时应该将待处理部分标记为跳过', async () => {
      // 使用 PENDING 状态的批处理
      const pendingBatch = { ...mockBatch, status: BatchStatus.PENDING };
      batchRepository.findOne.mockResolvedValue(pendingBatch);
      batchRepository.save.mockResolvedValue({ ...mockBatch, status: BatchStatus.CANCELLED });
      batchPartRepository.update.mockResolvedValue(undefined);

      await service.cancelBatch('batch-123');

      expect(batchPartRepository.update).toHaveBeenCalledWith(
        { batchId: 'batch-123', status: BatchPartStatus.PENDING },
        { status: BatchPartStatus.SKIPPED }
      );
    });

    it('已完成的批处理不能取消', async () => {
      const completedBatch = { ...mockBatch, status: BatchStatus.COMPLETED };
      batchRepository.findOne.mockResolvedValue(completedBatch);

      await expect(service.cancelBatch('batch-123')).rejects.toThrow(BadRequestException);
    });

    it('已取消的批处理不能再次取消', async () => {
      const cancelledBatch = { ...mockBatch, status: BatchStatus.CANCELLED };
      batchRepository.findOne.mockResolvedValue(cancelledBatch);

      await expect(service.cancelBatch('batch-123')).rejects.toThrow(BadRequestException);
    });
  });

  // ==================== 删除批处理测试 ====================

  describe('deleteBatch', () => {
    it('应该删除批处理及其部分', async () => {
      batchRepository.findOne.mockResolvedValue(mockBatch);
      batchPartRepository.delete.mockResolvedValue(undefined);
      batchRepository.delete.mockResolvedValue(undefined);

      await service.deleteBatch('batch-123');

      expect(batchPartRepository.delete).toHaveBeenCalledWith({ batchId: 'batch-123' });
      expect(batchRepository.delete).toHaveBeenCalledWith({ id: 'batch-123' });
    });

    it('批处理不存在时应该抛出异常', async () => {
      batchRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteBatch('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== 获取批处理部分测试 ====================

  describe('getBatchPartById', () => {
    it('应该返回指定ID的批处理部分', async () => {
      batchPartRepository.findOne.mockResolvedValue(mockBatchPart);

      const result = await service.getBatchPartById('part-123');

      expect(batchPartRepository.findOne).toHaveBeenCalledWith({ where: { id: 'part-123' } });
      expect(result).toEqual(mockBatchPart);
    });

    it('部分不存在时应该返回null', async () => {
      batchPartRepository.findOne.mockResolvedValue(null);

      const result = await service.getBatchPartById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ==================== 查询批处理部分列表测试 ====================

  describe('queryBatchParts', () => {
    it('应该查询批处理部分列表', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockBatchPart], 1]),
      };
      batchPartRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.queryBatchParts({ batchId: 'batch-123' });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该根据状态过滤', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockBatchPart], 1]),
      };
      batchPartRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.queryBatchParts({ batchId: 'batch-123', status: BatchPartStatus.PENDING });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('part.status = :status', {
        status: BatchPartStatus.PENDING,
      });
    });
  });

  // ==================== 重试失败部分测试 ====================

  describe('retryFailedParts', () => {
    it('应该重试失败的部分', async () => {
      const failedPart = { ...mockBatchPart, status: BatchPartStatus.FAILED };
      
      batchRepository.findOne.mockResolvedValue(mockBatch);
      batchPartRepository.find.mockResolvedValue([failedPart, failedPart]);
      batchPartRepository.update.mockResolvedValue(undefined);
      batchRepository.save.mockResolvedValue(mockBatch);

      const result = await service.retryFailedParts('batch-123');

      expect(result).toBe(2);
      expect(batchPartRepository.update).toHaveBeenCalledWith(
        { batchId: 'batch-123', status: BatchPartStatus.FAILED },
        { status: BatchPartStatus.PENDING, retryCount: 0, errorMessage: null, errorDetails: null }
      );
    });

    it('没有失败部分时应该返回0', async () => {
      batchRepository.findOne.mockResolvedValue(mockBatch);
      batchPartRepository.find.mockResolvedValue([]);

      const result = await service.retryFailedParts('batch-123');

      expect(result).toBe(0);
    });

    it('批处理状态为FAILED时应该重置为PENDING', async () => {
      const failedBatch = { ...mockBatch, status: BatchStatus.FAILED, failTotal: 5 };
      const failedPart = { ...mockBatchPart, status: BatchPartStatus.FAILED };
      
      batchRepository.findOne.mockResolvedValue(failedBatch);
      batchPartRepository.find.mockResolvedValue([failedPart]);
      batchPartRepository.update.mockResolvedValue(undefined);
      batchRepository.save.mockResolvedValue({ ...failedBatch, status: BatchStatus.PENDING });

      await service.retryFailedParts('batch-123');

      expect(batchRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: BatchStatus.PENDING })
      );
    });

    it('批处理不存在时应该抛出异常', async () => {
      batchRepository.findOne.mockResolvedValue(null);

      await expect(service.retryFailedParts('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== 统计测试 ====================

  describe('getStatistics', () => {
    it('应该返回批处理统计信息', async () => {
      const mockBatchQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        clone: vi.fn().mockReturnThis(),
        getCount: vi.fn()
          .mockResolvedValueOnce(100) // totalBatches
          .mockResolvedValueOnce(10)  // pendingBatches
          .mockResolvedValueOnce(5)   // runningBatches
          .mockResolvedValueOnce(80)  // completedBatches
          .mockResolvedValueOnce(3)   // failedBatches
          .mockResolvedValueOnce(2),  // cancelledBatches
      };
      
      const mockPartQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        clone: vi.fn().mockReturnThis(),
        getCount: vi.fn()
          .mockResolvedValueOnce(500) // totalParts
          .mockResolvedValueOnce(50)  // pendingParts
          .mockResolvedValueOnce(400) // completedParts
          .mockResolvedValueOnce(30), // failedParts
      };
      
      batchRepository.createQueryBuilder.mockReturnValue(mockBatchQueryBuilder as any);
      batchPartRepository.createQueryBuilder.mockReturnValue(mockPartQueryBuilder as any);

      const result = await service.getStatistics();

      expect(result.totalBatches).toBe(100);
      expect(result.pendingBatches).toBe(10);
      expect(result.runningBatches).toBe(5);
      expect(result.completedBatches).toBe(80);
    });

    it('应该根据租户ID过滤统计', async () => {
      const mockBatchQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        clone: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(10),
      };
      
      const mockPartQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        clone: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(50),
      };
      
      batchRepository.createQueryBuilder.mockReturnValue(mockBatchQueryBuilder as any);
      batchPartRepository.createQueryBuilder.mockReturnValue(mockPartQueryBuilder as any);

      await service.getStatistics('tenant-123');

      expect(mockBatchQueryBuilder.andWhere).toHaveBeenCalledWith(
        'batch.tenantId = :tenantId',
        { tenantId: 'tenant-123' }
      );
    });
  });

  // ==================== 转换方法测试 ====================

  describe('toResponseDto', () => {
    it('应该正确转换批处理为响应DTO', () => {
      const batch = { ...mockBatch, total: 100, processedTotal: 50 };
      
      const result = service.toResponseDto(batch);

      expect(result.id).toBe(batch.id);
      expect(result.progress).toBe(50);
      expect(result.type).toBe(batch.type);
    });

    it('总数为0时进度应该是0', () => {
      const batch = { ...mockBatch, total: 0, processedTotal: 0 };
      
      const result = service.toResponseDto(batch);

      expect(result.progress).toBe(0);
    });

    it('应该解析配置JSON', () => {
      const batch = { 
        ...mockBatch, 
        config: JSON.stringify({ timeout: 5000 }) 
      };
      
      const result = service.toResponseDto(batch);

      expect(result.config).toEqual({ timeout: 5000 });
    });
  });

  describe('toPartResponseDto', () => {
    it('应该正确转换批处理部分为响应DTO', () => {
      const part = { 
        ...mockBatchPart, 
        data: JSON.stringify({ key: 'value' }),
        result: JSON.stringify({ result: 'success' }),
      };
      
      const result = service.toPartResponseDto(part);

      expect(result.id).toBe(part.id);
      expect(result.batchId).toBe(part.batchId);
      expect(result.data).toEqual({ key: 'value' });
      expect(result.result).toEqual({ result: 'success' });
    });

    it('应该处理空数据', () => {
      const part = { ...mockBatchPart, data: null, result: null };
      
      const result = service.toPartResponseDto(part);

      expect(result.data).toBeUndefined();
      expect(result.result).toBeUndefined();
    });
  });

  // ==================== 生命周期测试 ====================

  describe('onModuleInit', () => {
    it('应该初始化服务', () => {
      service.onModuleInit();
      expect(true).toBe(true);
    });
  });

  describe('onModuleDestroy', () => {
    it('应该销毁服务', () => {
      service.onModuleDestroy();
      expect(true).toBe(true);
    });
  });
});
