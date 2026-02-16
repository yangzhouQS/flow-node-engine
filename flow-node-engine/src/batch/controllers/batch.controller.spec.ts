import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchPartEntity, BatchPartStatus } from '../entities/batch-part.entity';
import { BatchEntity, BatchStatus, BatchType } from '../entities/batch.entity';
import { BatchService } from '../services/batch.service';
import { BatchController } from './batch.controller';

describe('BatchController', () => {
  let controller: BatchController;
  let batchService: any;

  // Mock BatchService
  const mockBatchService: any = {
    createBatch: vi.fn(),
    queryBatches: vi.fn(),
    getBatchById: vi.fn(),
    updateBatch: vi.fn(),
    cancelBatch: vi.fn(),
    deleteBatch: vi.fn(),
    queryBatchParts: vi.fn(),
    getBatchPartById: vi.fn(),
    retryFailedParts: vi.fn(),
    executeBatch: vi.fn(),
    getStatistics: vi.fn(),
    toResponseDto: vi.fn(),
    toPartResponseDto: vi.fn(),
  };

  // Mock data
  const mockBatch: Partial<BatchEntity> = {
    id: 'batch-1',
    type: BatchType.CUSTOM,
    status: BatchStatus.RUNNING,
    total: 10,
    processedTotal: 5,
    failTotal: 1,
    searchKey: 'test-key',
    tenantId: 'tenant-1',
    createTime: new Date('2024-01-01T00:00:00Z'),
  };

  const mockBatchPart: Partial<BatchPartEntity> = {
    id: 'part-1',
    batchId: 'batch-1',
    status: BatchPartStatus.COMPLETED,
    result: JSON.stringify({ success: true }),
    createTime: new Date('2024-01-01T00:00:00Z'),
    startTime: new Date('2024-01-01T00:01:00Z'),
    completeTime: new Date('2024-01-01T00:02:00Z'),
  };

  const mockResponseDto = {
    id: 'batch-1',
    type: BatchType.CUSTOM,
    status: BatchStatus.RUNNING,
    total: 10,
    processedTotal: 5,
    failTotal: 1,
  };

  const mockPartResponseDto = {
    id: 'part-1',
    batchId: 'batch-1',
    status: BatchPartStatus.COMPLETED,
  };

  const mockStatistics = {
    total: 100,
    running: 10,
    completed: 80,
    failed: 10,
  };

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BatchController],
      providers: [
        {
          provide: BatchService,
          useValue: mockBatchService,
        },
      ],
    }).compile();

    controller = module.get<BatchController>(BatchController);
    batchService = mockBatchService as any;
  });

  describe('createBatch', () => {
    it('应该成功创建批处理', async () => {
      const createDto = {
        type: BatchType.CUSTOM,
        searchKey: 'test-key',
        tenantId: 'tenant-1',
      };

      batchService.createBatch.mockResolvedValue(mockBatch);

      const result = await controller.createBatch(createDto);

      expect(batchService.createBatch).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockBatch);
    });

    it('创建批处理时应该传递正确的参数', async () => {
      const createDto = {
        type: BatchType.CUSTOM,
        searchKey: 'user-123',
        tenantId: 'tenant-1',
        config: { batchSize: 100 },
      };

      batchService.createBatch.mockResolvedValue(mockBatch);

      await controller.createBatch(createDto);

      expect(batchService.createBatch).toHaveBeenCalledWith(createDto);
    });
  });

  describe('queryBatches', () => {
    it('应该成功查询批处理列表', async () => {
      const queryDto = { page: 1, pageSize: 10 };
      const queryResult = {
        data: [mockBatch],
        total: 1,
      };

      batchService.queryBatches.mockResolvedValue(queryResult);
      batchService.toResponseDto.mockReturnValue(mockResponseDto);

      const result = await controller.queryBatches(queryDto);

      expect(batchService.queryBatches).toHaveBeenCalledWith(queryDto);
      expect(result).toEqual({
        data: [mockResponseDto],
        total: 1,
      });
    });

    it('应该正确处理空结果', async () => {
      const queryDto = { status: BatchStatus.COMPLETED };
      const queryResult = {
        data: [],
        total: 0,
      };

      batchService.queryBatches.mockResolvedValue(queryResult);

      const result = await controller.queryBatches(queryDto);

      expect(result).toEqual({
        data: [],
        total: 0,
      });
    });

    it('应该支持按状态筛选', async () => {
      const queryDto = { status: BatchStatus.RUNNING };
      const queryResult = {
        data: [mockBatch],
        total: 1,
      };

      batchService.queryBatches.mockResolvedValue(queryResult);
      batchService.toResponseDto.mockReturnValue(mockResponseDto);

      await controller.queryBatches(queryDto);

      expect(batchService.queryBatches).toHaveBeenCalledWith(queryDto);
    });
  });

  describe('getStatistics', () => {
    it('应该返回批处理统计信息', async () => {
      batchService.getStatistics.mockResolvedValue(mockStatistics);

      const result = await controller.getStatistics();

      expect(batchService.getStatistics).toHaveBeenCalled();
      expect(result).toEqual(mockStatistics);
    });
  });

  describe('getBatch', () => {
    it('应该成功获取批处理详情', async () => {
      batchService.getBatchById.mockResolvedValue(mockBatch);
      batchService.toResponseDto.mockReturnValue(mockResponseDto);

      const result = await controller.getBatch('batch-1');

      expect(batchService.getBatchById).toHaveBeenCalledWith('batch-1');
      expect(result).toEqual(mockResponseDto);
    });

    it('批处理不存在时应该抛出错误', async () => {
      batchService.getBatchById.mockResolvedValue(null);

      await expect(controller.getBatch('non-existent')).rejects.toThrow(
        'Batch not found: non-existent',
      );
    });
  });

  describe('updateBatch', () => {
    it('应该成功更新批处理', async () => {
      const updateDto = { description: 'updated-description' };
      const updatedBatch = { ...mockBatch, description: 'updated-description' };

      batchService.updateBatch.mockResolvedValue(updatedBatch);
      batchService.toResponseDto.mockReturnValue({
        ...mockResponseDto,
        description: 'updated-description',
      });

      const result = await controller.updateBatch('batch-1', updateDto);

      expect(batchService.updateBatch).toHaveBeenCalledWith('batch-1', updateDto);
      expect(result.description).toBe('updated-description');
    });

    it('更新时应该传递正确的ID和DTO', async () => {
      const updateDto = { status: BatchStatus.CANCELLED };

      batchService.updateBatch.mockResolvedValue(mockBatch);
      batchService.toResponseDto.mockReturnValue(mockResponseDto);

      await controller.updateBatch('batch-123', updateDto);

      expect(batchService.updateBatch).toHaveBeenCalledWith('batch-123', updateDto);
    });
  });

  describe('cancelBatch', () => {
    it('应该成功取消批处理', async () => {
      const cancelledBatch = { ...mockBatch, status: BatchStatus.CANCELLED };

      batchService.cancelBatch.mockResolvedValue(cancelledBatch);
      batchService.toResponseDto.mockReturnValue({
        ...mockResponseDto,
        status: BatchStatus.CANCELLED,
      });

      const result = await controller.cancelBatch('batch-1');

      expect(batchService.cancelBatch).toHaveBeenCalledWith('batch-1');
      expect(result.status).toBe(BatchStatus.CANCELLED);
    });

    it('取消时应该传递正确的ID', async () => {
      batchService.cancelBatch.mockResolvedValue(mockBatch);
      batchService.toResponseDto.mockReturnValue(mockResponseDto);

      await controller.cancelBatch('batch-456');

      expect(batchService.cancelBatch).toHaveBeenCalledWith('batch-456');
    });
  });

  describe('deleteBatch', () => {
    it('应该成功删除批处理', async () => {
      batchService.deleteBatch.mockResolvedValue(undefined);

      await controller.deleteBatch('batch-1');

      expect(batchService.deleteBatch).toHaveBeenCalledWith('batch-1');
    });

    it('删除时应该传递正确的ID', async () => {
      batchService.deleteBatch.mockResolvedValue(undefined);

      await controller.deleteBatch('batch-to-delete');

      expect(batchService.deleteBatch).toHaveBeenCalledWith('batch-to-delete');
    });
  });

  describe('queryBatchParts', () => {
    it('应该成功查询批处理部分列表', async () => {
      const queryDto = { page: 1, pageSize: 10 };
      const queryResult = {
        data: [mockBatchPart],
        total: 1,
      };

      batchService.queryBatchParts.mockResolvedValue(queryResult);
      batchService.toPartResponseDto.mockReturnValue(mockPartResponseDto);

      const result = await controller.queryBatchParts('batch-1', queryDto);

      expect(batchService.queryBatchParts).toHaveBeenCalledWith({
        ...queryDto,
        batchId: 'batch-1',
      });
      expect(result).toEqual({
        data: [mockPartResponseDto],
        total: 1,
      });
    });

    it('应该正确处理空部分列表', async () => {
      const queryDto = { status: BatchPartStatus.FAILED, batchId: 'batch-1' };
      const queryResult = {
        data: [],
        total: 0,
      };

      batchService.queryBatchParts.mockResolvedValue(queryResult);

      const result = await controller.queryBatchParts('batch-1', queryDto);

      expect(result).toEqual({
        data: [],
        total: 0,
      });
    });
  });

  describe('getBatchPart', () => {
    it('应该成功获取批处理部分详情', async () => {
      batchService.getBatchPartById.mockResolvedValue(mockBatchPart);
      batchService.toPartResponseDto.mockReturnValue(mockPartResponseDto);

      const result = await controller.getBatchPart('batch-1', 'part-1');

      expect(batchService.getBatchPartById).toHaveBeenCalledWith('part-1');
      expect(result).toEqual(mockPartResponseDto);
    });

    it('部分不存在时应该抛出错误', async () => {
      batchService.getBatchPartById.mockResolvedValue(null);

      await expect(
        controller.getBatchPart('batch-1', 'non-existent'),
      ).rejects.toThrow('Batch part not found: non-existent');
    });
  });

  describe('retryFailedParts', () => {
    it('应该成功重试失败的部分', async () => {
      batchService.retryFailedParts.mockResolvedValue(5);

      const result = await controller.retryFailedParts('batch-1');

      expect(batchService.retryFailedParts).toHaveBeenCalledWith('batch-1');
      expect(result).toEqual({ count: 5 });
    });

    it('没有失败部分时应该返回0', async () => {
      batchService.retryFailedParts.mockResolvedValue(0);

      const result = await controller.retryFailedParts('batch-1');

      expect(result.count).toBe(0);
    });
  });

  describe('executeBatch', () => {
    it('应该成功启动批处理执行', async () => {
      batchService.getBatchById.mockResolvedValue(mockBatch);
      batchService.executeBatch.mockResolvedValue(undefined);

      const result = await controller.executeBatch('batch-1');

      expect(batchService.getBatchById).toHaveBeenCalledWith('batch-1');
      expect(batchService.executeBatch).toHaveBeenCalledWith(mockBatch);
      expect(result).toEqual({ message: 'Batch execution started' });
    });

    it('批处理不存在时应该抛出错误', async () => {
      batchService.getBatchById.mockResolvedValue(null);

      await expect(controller.executeBatch('non-existent')).rejects.toThrow(
        'Batch not found: non-existent',
      );

      expect(batchService.executeBatch).not.toHaveBeenCalled();
    });

    it('执行错误应该被捕获', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      batchService.getBatchById.mockResolvedValue(mockBatch);
      batchService.executeBatch.mockRejectedValue(new Error('Execution failed'));

      const result = await controller.executeBatch('batch-1');

      // 等待微任务队列完成
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(result).toEqual({ message: 'Batch execution started' });
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('边界条件测试', () => {
    it('创建批处理时应该处理空对象', async () => {
      batchService.createBatch.mockResolvedValue(mockBatch);

      const result = await controller.createBatch({} as any);

      expect(batchService.createBatch).toHaveBeenCalledWith({});
      expect(result).toBeDefined();
    });

    it('查询时应该处理大页码', async () => {
      const queryDto = { page: 1000, pageSize: 10 };
      const queryResult = {
        data: [],
        total: 5,
      };

      batchService.queryBatches.mockResolvedValue(queryResult);

      const result = await controller.queryBatches(queryDto);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(5);
    });

    it('查询时应该处理无效的批处理ID格式', async () => {
      batchService.getBatchById.mockResolvedValue(null);

      await expect(controller.getBatch('')).rejects.toThrow('Batch not found: ');
    });

    it('更新时应该处理空更新对象', async () => {
      batchService.updateBatch.mockResolvedValue(mockBatch);
      batchService.toResponseDto.mockReturnValue(mockResponseDto);

      const result = await controller.updateBatch('batch-1', {});

      expect(batchService.updateBatch).toHaveBeenCalledWith('batch-1', {});
      expect(result).toBeDefined();
    });
  });

  describe('并发场景测试', () => {
    it('应该支持同时查询多个批处理', async () => {
      const batch1 = { ...mockBatch, id: 'batch-1' };
      const batch2 = { ...mockBatch, id: 'batch-2' };

      batchService.getBatchById.mockImplementation((id) => {
        if (id === 'batch-1') return Promise.resolve(batch1);
        if (id === 'batch-2') return Promise.resolve(batch2);
        return Promise.resolve(null);
      });
      batchService.toResponseDto.mockImplementation((batch) => ({
        ...mockResponseDto,
        id: batch.id,
      }));

      const [result1, result2] = await Promise.all([
        controller.getBatch('batch-1'),
        controller.getBatch('batch-2'),
      ]);

      expect(result1.id).toBe('batch-1');
      expect(result2.id).toBe('batch-2');
    });
  });
});
