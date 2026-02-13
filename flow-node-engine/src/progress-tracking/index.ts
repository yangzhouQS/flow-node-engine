/**
 * 进度追踪模块导出
 */

// 实体
export { Progress, ProgressStatus, ProgressType } from './entities/progress.entity';
export { ProgressMetric, MetricType, MetricCategory } from './entities/progress-metric.entity';

// DTO
export {
  CreateProgressDto,
  UpdateProgressDto,
  ProgressQueryDto,
  ProgressStatisticsQueryDto,
  ProgressStatisticsDto,
  ProgressDashboardDto,
  CreateProgressMetricDto,
  ProgressMetricQueryDto,
} from './dto/progress.dto';

// 服务
export {
  ProgressTrackingService,
  ProgressEventType,
  ProgressEvent,
  ProcessInstanceEvent,
  TaskEvent,
} from './services/progress-tracking.service';

// 控制器
export { ProgressController } from './controllers/progress.controller';

// 网关
export { ProgressGateway } from './gateways/progress.gateway';

// 模块
export { ProgressTrackingModule } from './progress-tracking.module';
