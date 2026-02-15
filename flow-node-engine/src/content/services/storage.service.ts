/**
 * 存储服务
 * 支持本地存储和云存储（S3/OSS/COS）
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 存储类型枚举
 */
export enum StorageType {
  LOCAL = 'local',
  S3 = 's3',
  OSS = 'oss',
  COS = 'cos',
}

/**
 * 存储配置接口
 */
export interface StorageConfig {
  type: StorageType;
  basePath: string;
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  accessKeySecret?: string;
  endpoint?: string;
  useSSL?: boolean;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
}

/**
 * 上传结果接口
 */
export interface UploadResult {
  id: string;
  storeId: string;
  storeName: string;
  url: string;
  size: number;
  mimeType: string;
}

/**
 * 存储服务接口
 */
export interface IStorageProvider {
  store(file: Express.Multer.File, options?: StoreOptions): Promise<UploadResult>;
  retrieve(storeId: string): Promise<Buffer>;
  delete(storeId: string): Promise<void>;
  getUrl(storeId: string): string;
}

/**
 * 存储选项
 */
export interface StoreOptions {
  folder?: string;
  filename?: string;
  generateThumbnail?: boolean;
}

/**
 * 本地存储提供者
 */
@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly basePath: string;
  private readonly baseUrl: string;

  constructor(config: { basePath: string; baseUrl: string }) {
    this.basePath = config.basePath || './uploads';
    this.baseUrl = config.baseUrl || '/uploads';
    this.ensureDirectoryExists(this.basePath);
  }

  async store(file: Express.Multer.File, options?: StoreOptions): Promise<UploadResult> {
    const storeId = this.generateStoreId();
    const folder = options?.folder || '';
    const uploadDir = path.join(this.basePath, folder);
    
    this.ensureDirectoryExists(uploadDir);

    const ext = path.extname(file.originalname);
    const filename = options?.filename || `${storeId}${ext}`;
    const filePath = path.join(uploadDir, filename);

    await fs.promises.writeFile(filePath, file.buffer);

    const relativePath = folder ? `${folder}/${filename}` : filename;
    const url = `${this.baseUrl}/${relativePath}`;

    return {
      id: storeId,
      storeId: storeId,
      storeName: 'local',
      url: url,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  async retrieve(storeId: string): Promise<Buffer> {
    const files = await this.findFilesByStoreId(storeId);
    if (files.length === 0) {
      throw new BadRequestException(`File not found: ${storeId}`);
    }
    return fs.promises.readFile(files[0]);
  }

  async delete(storeId: string): Promise<void> {
    const files = await this.findFilesByStoreId(storeId);
    for (const file of files) {
      await fs.promises.unlink(file);
    }
  }

  getUrl(storeId: string): string {
    return `${this.baseUrl}/${storeId}`;
  }

  private generateStoreId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private async findFilesByStoreId(storeId: string): Promise<string[]> {
    const results: string[] = [];
    await this.searchFiles(this.basePath, storeId, results);
    return results;
  }

  private async searchFiles(dir: string, storeId: string, results: string[]): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.searchFiles(fullPath, storeId, results);
      } else if (entry.name.startsWith(storeId)) {
        results.push(fullPath);
      }
    }
  }
}

/**
 * 云存储提供者（模拟实现，实际使用时需要集成对应SDK）
 */
@Injectable()
export class CloudStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(CloudStorageProvider.name);
  private readonly config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.logger.log(`Cloud storage initialized: ${config.type}`);
  }

  async store(file: Express.Multer.File, options?: StoreOptions): Promise<UploadResult> {
    const storeId = this.generateStoreId();
    const ext = path.extname(file.originalname);
    const key = options?.folder 
      ? `${options.folder}/${storeId}${ext}`
      : `${storeId}${ext}`;

    // 模拟云存储上传
    // 实际实现需要根据 storageType 调用对应的 SDK
    // 例如: AWS S3 SDK, Aliyun OSS SDK, Tencent COS SDK
    this.logger.log(`Uploading to ${this.config.type}: ${key}`);

    const url = this.getUrl(storeId);

    return {
      id: storeId,
      storeId: storeId,
      storeName: this.config.type,
      url: url,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  async retrieve(storeId: string): Promise<Buffer> {
    // 模拟从云存储下载
    this.logger.log(`Retrieving from ${this.config.type}: ${storeId}`);
    throw new BadRequestException('Cloud storage retrieve not implemented');
  }

  async delete(storeId: string): Promise<void> {
    // 模拟从云存储删除
    this.logger.log(`Deleting from ${this.config.type}: ${storeId}`);
  }

  getUrl(storeId: string): string {
    switch (this.config.type) {
      case StorageType.S3:
        return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${storeId}`;
      case StorageType.OSS:
        return `https://${this.config.bucket}.${this.config.endpoint}/${storeId}`;
      case StorageType.COS:
        return `https://${this.config.bucket}.cos.${this.config.region}.myqcloud.com/${storeId}`;
      default:
        return `${this.config.endpoint}/${storeId}`;
    }
  }

  private generateStoreId(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}

/**
 * 存储服务
 * 统一的存储服务入口
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly provider: IStorageProvider;
  private readonly config: StorageConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
    this.provider = this.createProvider();
  }

  /**
   * 存储文件
   */
  async store(file: Express.Multer.File, options?: StoreOptions): Promise<UploadResult> {
    this.validateFile(file);
    return this.provider.store(file, options);
  }

  /**
   * 获取文件
   */
  async retrieve(storeId: string): Promise<Buffer> {
    return this.provider.retrieve(storeId);
  }

  /**
   * 删除文件
   */
  async delete(storeId: string): Promise<void> {
    return this.provider.delete(storeId);
  }

  /**
   * 获取文件URL
   */
  getUrl(storeId: string): string {
    return this.provider.getUrl(storeId);
  }

  /**
   * 获取存储配置
   */
  getConfig(): StorageConfig {
    return { ...this.config };
  }

  /**
   * 验证文件
   */
  private validateFile(file: Express.Multer.File): void {
    // 检查文件大小
    if (this.config.maxFileSize && file.size > this.config.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds limit: ${file.size} > ${this.config.maxFileSize}`
      );
    }

    // 检查文件类型
    if (this.config.allowedMimeTypes && this.config.allowedMimeTypes.length > 0) {
      if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `File type not allowed: ${file.mimetype}`
        );
      }
    }
  }

  /**
   * 加载配置
   */
  private loadConfig(): StorageConfig {
    const storageType = this.configService.get<string>('STORAGE_TYPE', 'local');
    
    return {
      type: storageType as StorageType,
      basePath: this.configService.get<string>('STORAGE_BASE_PATH', './uploads'),
      baseUrl: this.configService.get<string>('STORAGE_BASE_URL', '/uploads'),
      bucket: this.configService.get<string>('STORAGE_BUCKET'),
      region: this.configService.get<string>('STORAGE_REGION'),
      accessKeyId: this.configService.get<string>('STORAGE_ACCESS_KEY_ID'),
      accessKeySecret: this.configService.get<string>('STORAGE_ACCESS_KEY_SECRET'),
      endpoint: this.configService.get<string>('STORAGE_ENDPOINT'),
      useSSL: this.configService.get<boolean>('STORAGE_USE_SSL', true),
      maxFileSize: this.configService.get<number>('STORAGE_MAX_FILE_SIZE', 10 * 1024 * 1024), // 默认10MB
      allowedMimeTypes: this.configService.get<string>('STORAGE_ALLOWED_MIME_TYPES')?.split(','),
    };
  }

  /**
   * 创建存储提供者
   */
  private createProvider(): IStorageProvider {
    switch (this.config.type) {
      case StorageType.LOCAL:
        return new LocalStorageProvider({
          basePath: this.config.basePath,
          baseUrl: this.config.baseUrl || '/uploads',
        });
      case StorageType.S3:
      case StorageType.OSS:
      case StorageType.COS:
        return new CloudStorageProvider(this.config);
      default:
        this.logger.warn(`Unknown storage type: ${this.config.type}, using local storage`);
        return new LocalStorageProvider({
          basePath: this.config.basePath,
          baseUrl: this.config.baseUrl || '/uploads',
        });
    }
  }
}
