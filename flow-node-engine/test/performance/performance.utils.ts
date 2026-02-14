/**
 * 性能测试工具函数
 * 提供性能测试的基础设施和辅助函数
 */

/**
 * 性能测试结果接口
 */
export interface PerformanceResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p50: number;
  p95: number;
  p99: number;
  opsPerSecond: number;
  passed: boolean;
  target?: number;
}

/**
 * 单次测量结果
 */
export interface Measurement {
  duration: number;
  success: boolean;
  error?: Error;
}

/**
 * 性能测试配置
 */
export interface PerformanceConfig {
  /** 测试名称 */
  name: string;
  /** 迭代次数 */
  iterations: number;
  /** 预热次数（不计入统计） */
  warmupIterations?: number;
  /** 目标平均响应时间（毫秒） */
  targetAvgTime?: number;
  /** 目标吞吐量（操作/秒） */
  targetOpsPerSecond?: number;
  /** 并发数 */
  concurrency?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 计算百分位数
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

/**
 * 测量异步函数执行时间
 */
export async function measureAsync<T>(
  fn: () => Promise<T>
): Promise<{ duration: number; result: T; success: boolean; error?: Error }> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    return { duration, result, success: true };
  } catch (error) {
    const duration = performance.now() - start;
    return { duration, result: null as T, success: false, error: error as Error };
  }
}

/**
 * 测量同步函数执行时间
 */
export function measureSync<T>(fn: () => T): { duration: number; result: T; success: boolean; error?: Error } {
  const start = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - start;
    return { duration, result, success: true };
  } catch (error) {
    const duration = performance.now() - start;
    return { duration, result: null as T, success: false, error: error as Error };
  }
}

/**
 * 运行性能测试
 */
export async function runPerformanceTest(
  config: PerformanceConfig,
  testFn: (iteration: number) => Promise<void> | void
): Promise<PerformanceResult> {
  const { name, iterations, warmupIterations = 3, targetAvgTime, targetOpsPerSecond } = config;
  const measurements: number[] = [];
  let errors = 0;

  // 预热阶段
  for (let i = 0; i < warmupIterations; i++) {
    try {
      await testFn(i);
    } catch {
      // 预热错误忽略
    }
  }

  // 正式测量阶段
  const totalStart = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    const measurement = await measureAsync(() => Promise.resolve(testFn(i)));
    if (measurement.success) {
      measurements.push(measurement.duration);
    } else {
      errors++;
    }
  }
  
  const totalTime = performance.now() - totalStart;

  // 计算统计数据
  measurements.sort((a, b) => a - b);
  
  const avgTime = measurements.length > 0 
    ? measurements.reduce((sum, m) => sum + m, 0) / measurements.length 
    : 0;
  const minTime = measurements.length > 0 ? measurements[0] : 0;
  const maxTime = measurements.length > 0 ? measurements[measurements.length - 1] : 0;
  const p50 = percentile(measurements, 50);
  const p95 = percentile(measurements, 95);
  const p99 = percentile(measurements, 99);
  const opsPerSecond = (measurements.length / totalTime) * 1000;

  // 判断是否通过
  let passed = errors === 0;
  if (targetAvgTime !== undefined) {
    passed = passed && avgTime <= targetAvgTime;
  }
  if (targetOpsPerSecond !== undefined) {
    passed = passed && opsPerSecond >= targetOpsPerSecond;
  }

  return {
    name,
    iterations: measurements.length,
    totalTime,
    avgTime,
    minTime,
    maxTime,
    p50,
    p95,
    p99,
    opsPerSecond,
    passed,
    target: targetAvgTime,
  };
}

/**
 * 并发性能测试
 */
export async function runConcurrentTest(
  config: PerformanceConfig,
  testFn: (iteration: number) => Promise<void> | void
): Promise<PerformanceResult> {
  const { name, iterations, concurrency = 10, targetAvgTime } = config;
  const measurements: number[] = [];
  let errors = 0;

  const totalStart = performance.now();
  
  // 分批执行并发测试
  for (let i = 0; i < iterations; i += concurrency) {
    const batch = Math.min(concurrency, iterations - i);
    const promises: Promise<void>[] = [];
    
    for (let j = 0; j < batch; j++) {
      promises.push(
        (async () => {
          const start = performance.now();
          try {
            await testFn(i + j);
            measurements.push(performance.now() - start);
          } catch {
            errors++;
          }
        })()
      );
    }
    
    await Promise.all(promises);
  }
  
  const totalTime = performance.now() - totalStart;

  // 计算统计数据
  measurements.sort((a, b) => a - b);
  
  const avgTime = measurements.length > 0 
    ? measurements.reduce((sum, m) => sum + m, 0) / measurements.length 
    : 0;
  const minTime = measurements.length > 0 ? measurements[0] : 0;
  const maxTime = measurements.length > 0 ? measurements[measurements.length - 1] : 0;
  const p50 = percentile(measurements, 50);
  const p95 = percentile(measurements, 95);
  const p99 = percentile(measurements, 99);
  const opsPerSecond = (measurements.length / totalTime) * 1000;

  let passed = errors === 0;
  if (targetAvgTime !== undefined) {
    passed = passed && avgTime <= targetAvgTime;
  }

  return {
    name,
    iterations: measurements.length,
    totalTime,
    avgTime,
    minTime,
    maxTime,
    p50,
    p95,
    p99,
    opsPerSecond,
    passed,
    target: targetAvgTime,
  };
}

/**
 * 格式化性能测试结果
 */
export function formatPerformanceResult(result: PerformanceResult): string {
  const lines = [
    `📊 ${result.name}`,
    `   迭代次数: ${result.iterations}`,
    `   总耗时: ${result.totalTime.toFixed(2)}ms`,
    `   平均耗时: ${result.avgTime.toFixed(2)}ms`,
    `   最小耗时: ${result.minTime.toFixed(2)}ms`,
    `   最大耗时: ${result.maxTime.toFixed(2)}ms`,
    `   P50: ${result.p50.toFixed(2)}ms`,
    `   P95: ${result.p95.toFixed(2)}ms`,
    `   P99: ${result.p99.toFixed(2)}ms`,
    `   吞吐量: ${result.opsPerSecond.toFixed(2)} ops/s`,
  ];
  
  if (result.target !== undefined) {
    lines.push(`   目标: ${result.target}ms`);
  }
  
  lines.push(`   状态: ${result.passed ? '✅ 通过' : '❌ 失败'}`);
  
  return lines.join('\n');
}

/**
 * 性能断言辅助函数
 */
export function assertPerformance(
  result: PerformanceResult,
  options: {
    maxAvgTime?: number;
    minOpsPerSecond?: number;
    maxP95?: number;
    maxErrorRate?: number;
  } = {}
): void {
  const { maxAvgTime, minOpsPerSecond, maxP95, maxErrorRate = 0 } = options;

  if (maxAvgTime !== undefined && result.avgTime > maxAvgTime) {
    throw new Error(
      `平均响应时间 ${result.avgTime.toFixed(2)}ms 超过目标 ${maxAvgTime}ms`
    );
  }

  if (minOpsPerSecond !== undefined && result.opsPerSecond < minOpsPerSecond) {
    throw new Error(
      `吞吐量 ${result.opsPerSecond.toFixed(2)} ops/s 低于目标 ${minOpsPerSecond} ops/s`
    );
  }

  if (maxP95 !== undefined && result.p95 > maxP95) {
    throw new Error(
      `P95 响应时间 ${result.p95.toFixed(2)}ms 超过目标 ${maxP95}ms`
    );
  }

  const errorRate = (result.iterations - (result as any).successCount || 0) / result.iterations;
  if (errorRate > maxErrorRate) {
    throw new Error(
      `错误率 ${(errorRate * 100).toFixed(2)}% 超过目标 ${(maxErrorRate * 100)}%`
    );
  }
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 生成随机字符串
 */
export function randomString(length: number = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成随机整数
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
