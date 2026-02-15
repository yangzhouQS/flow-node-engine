/**
 * 存储服务单元测试
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService, StorageType } from './storage.service';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  statSync: jest.fn(),
}));

describe('StorageService', () => {
  let service: StorageService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        'storage.type': StorageType.LOCAL,
        'storage.local.basePath': './uploads',
        'storage.s3.bucket': 'test-bucket',
        'storage.s3.region': 'us-east-1',
        'storage.s3.accessKeyId': 'test-access-key',
        'storage.s3.secretAccessKey': 'test-secret-key',
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

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
      expect(configService.get).toHaveBeenCalledWith('storage.type', StorageType.LOCAL);
    });
  });

  describe('store (Local Storage)', () => {
    it('should store a file locally', async () => {
      const content = Buffer.from('test content');
      const filename = 'test-file.txt';
      const options = { mimeType: 'text/plain' };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      const result = await service.store(content, filename, options);

      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('size', content.length);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should create directory if not exists', async () => {
      const content = Buffer.from('test content');
      const filename = 'test-file.txt';

      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      const result = await service.store(content, filename);

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(result).toHaveProperty('path');
    });

    it('should generate unique filename with timestamp', async () => {
      const content = Buffer.from('test content');
      const filename = 'test-file.txt';

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      const result = await service.store(content, filename);

      expect(result.path).toContain('-');
    });
  });

  describe('retrieve (Local Storage)', () => {
    it('should retrieve a file content', async () => {
      const filePath = '/uploads/test-file.txt';
      const content = Buffer.from('test content');

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(content);

      const result = await service.retrieve(filePath);

      expect(result).toEqual(content);
      expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('test-file.txt'));
    });

    it('should throw error when file not found', async () => {
      const filePath = '/uploads/non-existent.txt';

      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(service.retrieve(filePath)).rejects.toThrow('File not found');
    });
  });

  describe('delete (Local Storage)', () => {
    it('should delete a file', async () => {
      const filePath = '/uploads/test-file.txt';

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);

      await service.delete(filePath);

      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('test-file.txt'));
    });

    it('should not throw error when file not found', async () => {
      const filePath = '/uploads/non-existent.txt';

      (fs.existsSync as jest.Mock).mockReturnValue(false);

      // Should not throw
      await expect(service.delete(filePath)).resolves.not.toThrow();
    });
  });

  describe('getSignedUrl', () => {
    it('should return local file URL for local storage', async () => {
      const filePath = '/uploads/test-file.txt';

      const result = await service.getSignedUrl(filePath);

      expect(result).toContain('/contents/');
    });

    it('should return URL with expiration parameter', async () => {
      const filePath = '/uploads/test-file.txt';
      const expiresIn = 3600;

      const result = await service.getSignedUrl(filePath, expiresIn);

      expect(result).toContain('expiresIn=');
    });
  });

  describe('getStorageStats', () => {
    it('should return storage statistics', async () => {
      const stats = service.getStorageStats();

      expect(stats).toHaveProperty('type');
      expect(stats).toHaveProperty('basePath');
    });
  });

  describe('validateFile', () => {
    it('should validate file size within limit', () => {
      const size = 1024 * 1024; // 1MB
      const maxSize = 10 * 1024 * 1024; // 10MB

      const result = service.validateFileSize(size, maxSize);

      expect(result).toBe(true);
    });

    it('should reject file size exceeding limit', () => {
      const size = 20 * 1024 * 1024; // 20MB
      const maxSize = 10 * 1024 * 1024; // 10MB

      const result = service.validateFileSize(size, maxSize);

      expect(result).toBe(false);
    });

    it('should validate allowed mime types', () => {
      const mimeType = 'application/pdf';
      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];

      const result = service.validateMimeType(mimeType, allowedTypes);

      expect(result).toBe(true);
    });

    it('should reject disallowed mime types', () => {
      const mimeType = 'application/exe';
      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];

      const result = service.validateMimeType(mimeType, allowedTypes);

      expect(result).toBe(false);
    });
  });

  describe('generateFilePath', () => {
    it('should generate file path with date-based subdirectories', () => {
      const filename = 'test-file.txt';

      const result = service.generateFilePath(filename);

      expect(result).toMatch(/\d{4}\/\d{2}\/\d{2}/);
    });

    it('should preserve original file extension', () => {
      const filename = 'document.pdf';

      const result = service.generateFilePath(filename);

      expect(result).toContain('.pdf');
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extension correctly', () => {
      expect(service.getFileExtension('document.pdf')).toBe('.pdf');
      expect(service.getFileExtension('image.png')).toBe('.png');
      expect(service.getFileExtension('archive.tar.gz')).toBe('.gz');
    });

    it('should return empty string for files without extension', () => {
      expect(service.getFileExtension('README')).toBe('');
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove dangerous characters from filename', () => {
      const dangerousFilename = '../../../etc/passwd';
      
      const result = service.sanitizeFilename(dangerousFilename);

      expect(result).not.toContain('..');
      expect(result).not.toContain('/');
    });

    it('should preserve safe characters', () => {
      const safeFilename = 'my-document_v2.pdf';
      
      const result = service.sanitizeFilename(safeFilename);

      expect(result).toBe('my-document_v2.pdf');
    });
  });
});
