import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgressGateway } from '../gateways/progress.gateway';
import { ProgressTrackingService } from '../services/progress-tracking.service';
import { ProgressController } from './progress.controller';

describe('ProgressController', () => {
  let controller: ProgressController;
  let progressTrackingService: ProgressTrackingService;
  let progressGateway: ProgressGateway;

  const mockProgressTrackingService = {
    createProgress: vi.fn(),
    updateProgress: vi.fn(),
    getProgressById: vi.fn(),
    getProgressByProcessInstanceId: vi.fn(),
    getProgressByTaskId: vi.fn(),
    queryProgress: vi.fn(),
    deleteProgress: vi.fn(),
    completeProcessProgress: vi.fn(),
    calculateProcessProgress: vi.fn(),
    getStatistics: vi.fn(),
    getDashboard: vi.fn(),
    recordMetric: vi.fn(),
    queryMetrics: vi.fn(),
    getPrometheusMetrics: vi.fn(),
  };

  const mockProgressGateway = {
    getOnlineCount: vi.fn(),
    getSubscriptionStats: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgressController],
      providers: [
        { provide: ProgressTrackingService, useValue: mockProgressTrackingService },
        { provide: ProgressGateway, useValue: mockProgressGateway },
      ],
    }).compile();

    controller = module.get<ProgressController>(ProgressController);
    progressTrackingService = module.get<ProgressTrackingService>(ProgressTrackingService);
    progressGateway = module.get<ProgressGateway>(ProgressGateway);
  });

  describe('create', () => {
    it('应该创建进度记录', async () => {
      const dto = {
        id_: 'progress-1',
        process_inst_id_: 'proc-1',
        process_def_key_: 'test-process',
        tenant_id_: 'tenant-1',
      };
      const mockProgress = { id: 'progress-1', process_inst_id_: 'proc-1' };
      mockProgressTrackingService.createProgress.mockResolvedValue(mockProgress);

      const result = await controller.create(dto);

      expect(mockProgressTrackingService.createProgress).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockProgress);
    });

    it('应该处理创建失败的情况', async () => {
      const dto = { id_: 'progress-2', process_inst_id_: 'proc-1' };
      mockProgressTrackingService.createProgress.mockRejectedValue(new Error('创建失败'));

      await expect(controller.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('应该更新进度', async () => {
      const dto = { percentage_: 50 };
      const mockProgress = { id: 'progress-1', percentage_: 50 };
      mockProgressTrackingService.updateProgress.mockResolvedValue(mockProgress);

      const result = await controller.update('progress-1', dto);

      expect(mockProgressTrackingService.updateProgress).toHaveBeenCalledWith('progress-1', dto);
      expect(result).toEqual(mockProgress);
    });

    it('应该处理进度不存在的情况', async () => {
      const dto = { percentage_: 50 };
      mockProgressTrackingService.updateProgress.mockRejectedValue(new Error('进度记录不存在'));

      await expect(controller.update('nonexistent', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getById', () => {
    it('应该根据ID返回进度', async () => {
      const mockProgress = { id: 'progress-1', percentage: 30 };
      mockProgressTrackingService.getProgressById.mockResolvedValue(mockProgress);

      const result = await controller.getById('progress-1');

      expect(mockProgressTrackingService.getProgressById).toHaveBeenCalledWith('progress-1');
      expect(result).toEqual(mockProgress);
    });

    it('应该处理进度不存在的情况', async () => {
      mockProgressTrackingService.getProgressById.mockResolvedValue(null);

      await expect(controller.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getByProcessInstanceId', () => {
    it('应该根据流程实例ID返回进度', async () => {
      const mockProgress = { id: 'progress-1', processInstanceId: 'proc-1', percentage: 60 };
      mockProgressTrackingService.getProgressByProcessInstanceId.mockResolvedValue(mockProgress);

      const result = await controller.getByProcessInstanceId('proc-1');

      expect(mockProgressTrackingService.getProgressByProcessInstanceId).toHaveBeenCalledWith('proc-1');
      expect(result).toEqual(mockProgress);
    });

    it('应该处理进度不存在的情况', async () => {
      mockProgressTrackingService.getProgressByProcessInstanceId.mockResolvedValue(null);

      await expect(controller.getByProcessInstanceId('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getByTaskId', () => {
    it('应该根据任务ID返回进度', async () => {
      const mockProgress = { id: 'progress-1', taskId: 'task-1', percentage: 40 };
      mockProgressTrackingService.getProgressByTaskId.mockResolvedValue(mockProgress);

      const result = await controller.getByTaskId('task-1');

      expect(mockProgressTrackingService.getProgressByTaskId).toHaveBeenCalledWith('task-1');
      expect(result).toEqual(mockProgress);
    });

    it('应该处理任务进度不存在的情况', async () => {
      mockProgressTrackingService.getProgressByTaskId.mockResolvedValue(null);

      await expect(controller.getByTaskId('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('query', () => {
    it('应该查询进度列表', async () => {
      const query = { processInstanceId: 'proc-1', page: 1, pageSize: 10 };
      const mockResult = {
        list: [{ id: 'progress-1', percentage: 50 }],
        total: 1,
      };
      mockProgressTrackingService.queryProgress.mockResolvedValue(mockResult);

      const result = await controller.query(query);

      expect(mockProgressTrackingService.queryProgress).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('delete', () => {
    it('应该删除进度', async () => {
      mockProgressTrackingService.deleteProgress.mockResolvedValue(undefined);

      await controller.delete('progress-1');

      expect(mockProgressTrackingService.deleteProgress).toHaveBeenCalledWith('progress-1');
    });
  });

  describe('completeProcessProgress', () => {
    it('应该完成流程进度', async () => {
      const mockProgress = { id: 'progress-1', percentage: 100, status: 'COMPLETED' };
      mockProgressTrackingService.completeProcessProgress.mockResolvedValue(mockProgress);

      const result = await controller.completeProcessProgress('proc-1');

      expect(mockProgressTrackingService.completeProcessProgress).toHaveBeenCalledWith('proc-1');
      expect(result).toEqual(mockProgress);
    });

    it('应该处理进度不存在的情况', async () => {
      mockProgressTrackingService.completeProcessProgress.mockRejectedValue(new Error('进度记录不存在'));

      await expect(controller.completeProcessProgress('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('calculatePercentage', () => {
    it('应该计算流程进度百分比', async () => {
      mockProgressTrackingService.calculateProcessProgress.mockResolvedValue(75);

      const result = await controller.calculatePercentage('proc-1');

      expect(mockProgressTrackingService.calculateProcessProgress).toHaveBeenCalledWith('proc-1');
      expect(result).toEqual({ percentage: 75 });
    });
  });

  describe('getStatistics', () => {
    it('应该获取进度统计', async () => {
      const query = { tenant_id_: 'tenant-1' };
      const mockStats = {
        total_instances: 100,
        completed_instances: 60,
        avg_percentage: 65.5,
      };
      mockProgressTrackingService.getStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics(query);

      expect(mockProgressTrackingService.getStatistics).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockStats);
    });
  });

  describe('getDashboard', () => {
    it('应该获取进度看板数据', async () => {
      const mockDashboard = {
        totalProcesses: 100,
        inProgress: 30,
        completed: 60,
        recentActivities: [],
      };
      mockProgressTrackingService.getDashboard.mockResolvedValue(mockDashboard);

      const result = await controller.getDashboard('tenant-1');

      expect(mockProgressTrackingService.getDashboard).toHaveBeenCalledWith('tenant-1');
      expect(result).toEqual(mockDashboard);
    });

    it('应该支持不传租户ID参数', async () => {
      const mockDashboard = { totalProcesses: 50 };
      mockProgressTrackingService.getDashboard.mockResolvedValue(mockDashboard);

      const result = await controller.getDashboard();

      expect(mockProgressTrackingService.getDashboard).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockDashboard);
    });
  });

  describe('getWebSocketStats', () => {
    it('应该获取WebSocket连接统计', () => {
      mockProgressGateway.getOnlineCount.mockReturnValue(15);
      mockProgressGateway.getSubscriptionStats.mockReturnValue({
        totalClients: 15,
        totalProcessSubscriptions: 25,
        totalTaskSubscriptions: 40,
      });

      const result = controller.getWebSocketStats();

      expect(result).toEqual({
        onlineCount: 15,
        subscriptions: {
          totalClients: 15,
          totalProcessSubscriptions: 25,
          totalTaskSubscriptions: 40,
        },
      });
    });
  });

  describe('recordMetric', () => {
    it('应该记录指标', async () => {
      const dto = {
        id_: 'metric-1',
        name_: 'process_duration',
        value_: 1500,
        labels_: { processKey: 'test-process' },
      };
      mockProgressTrackingService.recordMetric.mockResolvedValue(undefined);

      await controller.recordMetric(dto);

      expect(mockProgressTrackingService.recordMetric).toHaveBeenCalledWith(dto);
    });
  });

  describe('queryMetrics', () => {
    it('应该查询指标', async () => {
      const query = { name_: 'process_duration', start_time: new Date(), end_time: new Date() };
      const mockResult = {
        list: [{ name_: 'process_duration', value_: 1500 }],
        total: 1,
      };
      mockProgressTrackingService.queryMetrics.mockResolvedValue(mockResult);

      const result = await controller.queryMetrics(query);

      expect(mockProgressTrackingService.queryMetrics).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getPrometheusMetrics', () => {
    it('应该获取Prometheus格式指标', async () => {
      const mockMetrics = '# HELP process_duration Process duration\n# TYPE process_duration gauge\n';
      mockProgressTrackingService.getPrometheusMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getPrometheusMetrics();

      expect(mockProgressTrackingService.getPrometheusMetrics).toHaveBeenCalled();
      expect(result).toEqual(mockMetrics);
    });
  });
});
