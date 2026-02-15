/**
 * 存储服务单元测试
 */
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { StorageService, StorageType } from './storage.service';

// Mock fs module with promises
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  promises: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    unlink: vi.fn(),
    readdir: vi.fn(),
  },
}));

describe('StorageService', () => {
  let service: StorageService;
  let configService: ConfigService;

  const mockConfigService = {
    get: vi.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        STORAGE_TYPE: StorageType.LOCAL,
        STORAGE_BASE_PATH: './uploads',
        STORAGE_BASE_URL: '/uploads',
        STORAGE_BUCKET: 'test-bucket',
        STORAGE_REGION: 'us-east-1',
        STORAGE_ACCESS_KEY_ID: 'test-access-key',
        STORAGE_ACCESS_KEY_SECRET: 'test-secret-key',
        STORAGE_ENDPOINT: 'https://storage.example.com',
        STORAGE_USE_SSL: true,
        STORAGE_MAX_FILE_SIZE: 10 * 1024 * 1024,
        STORAGE_ALLOWED_MIME_TYPES: undefined,
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('initialize', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with local storage type', () => {
      expect(configService.get).toHaveBeenCalledWith('STORAGE_TYPE', 'local');
    });
  });

  describe('store (Local Storage)', () => {
    it('should store a file locally', async () => {
      const file = {
        originalname: 'test-file.txt',
        buffer: Buffer.from('test content'),
        size: 12,
        mimetype: 'text/plain',
      } as Express.Multer.File;

      (fs.existsSync as any).mockReturnValue(true);
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      const result = await service.store(file);

      expect(result).toHaveProperty('storeId');
      expect(result).toHaveProperty('size', file.size);
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should create directory if not exists', async () => {
      const file = {
        originalname: 'test-file.txt',
        buffer: Buffer.from('test content'),
        size: 12,
        mimetype: 'text/plain',
      } as Express.Multer.File;

      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockReturnValue(undefined);
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      const result = await service.store(file);

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(result).toHaveProperty('storeId');
    });
  });

  describe('retrieve (Local Storage)', () => {
    it('should retrieve a file content', async () => {
      const storeId = 'test-store-id';
      const content = Buffer.from('test content');

      (fs.promises.readdir as any).mockResolvedValue([
        { name: `${storeId}.txt`, isDirectory: () => false },
      ]);
      (fs.promises.readFile as any).mockResolvedValue(content);

      const result = await service.retrieve(storeId);

      expect(result).toEqual(content);
    });

    it('should throw error when file not found', async () => {
      const storeId = 'non-existent-id';

      (fs.promises.readdir as any).mockResolvedValue([]);

      await expect(service.retrieve(storeId)).rejects.toThrow('File not found');
    });
  });

  describe('delete (Local Storage)', () => {
    it('should delete a file', async () => {
      const storeId = 'test-store-id';

      (fs.promises.readdir as any).mockResolvedValue([
        { name: `${storeId}.txt`, isDirectory: () => false },
      ]);
      (fs.promises.unlink as any).mockResolvedValue(undefined);

      await service.delete(storeId);

      expect(fs.promises.unlink).toHaveBeenCalled();
    });

    it('should not throw error when file not found', async () => {
      const storeId = 'non-existent-id';

      (fs.promises.readdir as any).mockResolvedValue([]);

      // Should not throw
      await expect(service.delete(storeId)).resolves.not.toThrow();
    });
  });

  describe('getUrl', () => {
    it('should return URL for storeId', () => {
      const storeId = 'test-store-id';

      const result = service.getUrl(storeId);

      expect(result).toContain(storeId);
    });
  });

  describe('getConfig', () => {
    it('should return storage configuration', () => {
      const config = service.getConfig();

      expect(config).toHaveProperty('type');
      expect(config).toHaveProperty('basePath');
    });
  });
});
