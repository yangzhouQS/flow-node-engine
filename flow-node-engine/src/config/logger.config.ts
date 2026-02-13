import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export const createLoggerConfig = (configService: ConfigService) => {
  const logDir = configService.get('LOG_DIR') || 'logs';
  const logLevel = configService.get('LOG_LEVEL') || 'info';
  const isProduction = configService.get('NODE_ENV') === 'production';

  // 日志格式
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  // 日志传输
  const transports: winston.transport[] = [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  ];

  // 生产环境添加文件输出
  if (isProduction) {
    // 按日期分割的日志文件
    transports.push(
      new DailyRotateFile({
        filename: `${logDir}/app-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: logFormat,
        level: logLevel,
      }),
    );

    // 错误日志单独记录
    transports.push(
      new DailyRotateFile({
        filename: `${logDir}/error-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        format: logFormat,
        level: 'error',
      }),
    );
  }

  return {
    level: logLevel,
    format: logFormat,
    transports,
    exitOnError: false,
  };
};
