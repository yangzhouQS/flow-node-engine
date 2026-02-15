/**
 * 内容服务单元测试
 */
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Attachment, AttachmentType } from '../entities/attachment.entity';
import { ContentItem, ContentItemType, ContentItemStatus } from '../entities/content-item.entity';
import { ContentService } from './content.service';
import { StorageService } from './storage.service';

describe('ContentService', () => {
  let service: ContentService;
  let contentItemRepository: Repository<ContentItem>;
  let attachmentRepository: Repository<Attachment>;
  let storageService: StorageService;

  const mockContentItem: Partial<ContentItem> = {
    id: 'test-content-id',
    name: 'Test Document.pdf',
    type: ContentItemType.DOCUMENT,
    mimeType: 'application/pdf',
    contentSize: 1024,
    contentStoreId: 'store-1',
    contentStoreName: 'local',
    contentUrl: '/uploads/test-document.pdf',
    status: ContentItemStatus.ACTIVE,
    version: 1,
    createdBy: 'user-1',
    lastModifiedBy: 'user-1',
    processInstanceId: 'process-1',
    taskId: 'task-1',
    tenantId: 'tenant-1',
    metadata: { key: 'value' },
    createTime: new Date(),
    lastModified: new Date(),
  };

  const mockAttachment: Partial<Attachment> = {
    id: 'test-attachment-id',
    name: 'Attachment.pdf',
    description: 'Test attachment',
    url: '/contents/test-content-id/download',
    contentItemId: 'test-content-id',
    contentItem: null as any, // 设置为 null 避免在 map 中调用 this.toContentItemResponseDto 时出错
    processInstanceId: 'process-1',
    taskId: 'task-1',
    attachmentType: AttachmentType.GENERAL,
    createdBy: 'user-1',
    tenantId: 'tenant-1',
    createTime: new Date(),
    isDeleted: false,
  };

  // 创建持久的 queryBuilder mock 对象
  const mockContentItemQueryBuilder = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn(),
    getOne: vi.fn(),
    leftJoinAndSelect: vi.fn().mockReturnThis(),
  };

  const mockAttachmentQueryBuilder = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn(),
    getOne: vi.fn(),
    leftJoinAndSelect: vi.fn().mockReturnThis(),
  };

  const mockContentItemRepository = {
    create: vi.fn(),
    save: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    update: vi.fn(),
    createQueryBuilder: vi.fn(() => mockContentItemQueryBuilder),
  };

  const mockAttachmentRepository = {
    create: vi.fn(),
    save: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    update: vi.fn(),
    createQueryBuilder: vi.fn(() => mockAttachmentQueryBuilder),
  };

  const mockStorageService = {
    store: vi.fn(),
    retrieve: vi.fn(),
    delete: vi.fn(),
    getUrl: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentService,
        {
          provide: getRepositoryToken(ContentItem),
          useValue: mockContentItemRepository,
        },
        {
          provide: getRepositoryToken(Attachment),
          useValue: mockAttachmentRepository,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    service = module.get<ContentService>(ContentService);
    contentItemRepository = module.get<Repository<ContentItem>>(getRepositoryToken(ContentItem));
    attachmentRepository = module.get<Repository<Attachment>>(getRepositoryToken(Attachment));
    storageService = module.get<StorageService>(StorageService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    // 重置 queryBuilder mock
    mockContentItemQueryBuilder.getManyAndCount.mockReset();
    mockContentItemQueryBuilder.getOne.mockReset();
    mockAttachmentQueryBuilder.getManyAndCount.mockReset();
    mockAttachmentQueryBuilder.getOne.mockReset();
    // 重置 mockContentItem 数据
    mockContentItem.name = 'Test Document.pdf';
  });

  describe('createContentItem', () => {
    it('should successfully create a content item', async () => {
      const createDto = {
        name: 'Test Document.pdf',
        type: ContentItemType.DOCUMENT,
        mimeType: 'application/pdf',
        contentSize: 1024,
        createdBy: 'user-1',
      };

      mockContentItemRepository.create.mockReturnValue(mockContentItem);
      mockContentItemRepository.save.mockResolvedValue(mockContentItem);

      const result = await service.createContentItem(createDto);

      expect(mockContentItemRepository.create).toHaveBeenCalled();
      expect(mockContentItemRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockContentItem);
    });

    it('should create content item with process instance association', async () => {
      const createDto = {
        name: 'Test Document.pdf',
        type: ContentItemType.DOCUMENT,
        mimeType: 'application/pdf',
        contentSize: 1024,
        createdBy: 'user-1',
        processInstanceId: 'process-1',
      };

      mockContentItemRepository.create.mockReturnValue(mockContentItem);
      mockContentItemRepository.save.mockResolvedValue(mockContentItem);

      const result = await service.createContentItem(createDto);

      expect(result.processInstanceId).toBe('process-1');
    });
  });

  describe('findContentItemById', () => {
    it('should return a content item when found', async () => {
      mockContentItemRepository.findOne.mockResolvedValue(mockContentItem);

      const result = await service.findContentItemById('test-content-id');

      expect(result).toEqual(mockContentItem);
    });

    it('should throw NotFoundException when content item not found', async () => {
      mockContentItemRepository.findOne.mockResolvedValue(null);

      await expect(service.findContentItemById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateContentItem', () => {
    it('should successfully update a content item', async () => {
      const updateDto = {
        name: 'Updated Document.pdf',
        lastModifiedBy: 'user-1',
      };

      const updatedItem = { ...mockContentItem, name: 'Updated Document.pdf', version: 2 };

      mockContentItemRepository.findOne.mockResolvedValue(mockContentItem);
      mockContentItemRepository.save.mockResolvedValue(updatedItem);

      const result = await service.updateContentItem('test-content-id', updateDto);

      expect(result.name).toBe('Updated Document.pdf');
    });
  });

  describe('deleteContentItem', () => {
    it('should soft delete a content item', async () => {
      mockContentItemRepository.findOne.mockResolvedValue(mockContentItem);
      mockStorageService.delete.mockResolvedValue(undefined);
      mockContentItemRepository.update.mockResolvedValue({ affected: 1 });

      await service.deleteContentItem('test-content-id');

      expect(mockContentItemRepository.update).toHaveBeenCalled();
    });
  });

  describe('archiveContentItem', () => {
    it('should archive a content item', async () => {
      const archivedItem = { ...mockContentItem, status: ContentItemStatus.ARCHIVED };
      
      mockContentItemRepository.findOne.mockResolvedValue(mockContentItem);
      mockContentItemRepository.save.mockResolvedValue(archivedItem);

      const result = await service.archiveContentItem('test-content-id');

      expect(result.status).toBe(ContentItemStatus.ARCHIVED);
    });
  });

  describe('queryContentItems', () => {
    it('should return paginated content items', async () => {
      const queryDto = {
        page: 1,
        pageSize: 10,
      };

      mockContentItemRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([[mockContentItem], 1]);

      const result = await service.queryContentItems(queryDto);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by process instance id', async () => {
      const queryDto = {
        processInstanceId: 'process-1',
        page: 1,
        pageSize: 10,
      };

      mockContentItemRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([[mockContentItem], 1]);

      const result = await service.queryContentItems(queryDto);

      expect(result.data).toHaveLength(1);
    });
  });

  describe('createAttachment', () => {
    it('should successfully create an attachment', async () => {
      const createDto = {
        name: 'Attachment.pdf',
        description: 'Test attachment',
        contentItemId: 'test-content-id',
        processInstanceId: 'process-1',
        createdBy: 'user-1',
      };

      mockContentItemRepository.findOne.mockResolvedValue(mockContentItem);
      mockAttachmentRepository.create.mockReturnValue(mockAttachment);
      mockAttachmentRepository.save.mockResolvedValue(mockAttachment);

      const result = await service.createAttachment(createDto);

      expect(mockAttachmentRepository.create).toHaveBeenCalled();
      expect(mockAttachmentRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockAttachment);
    });

    it('should throw NotFoundException when content item not found', async () => {
      const createDto = {
        name: 'Attachment.pdf',
        contentItemId: 'non-existent-id',
        createdBy: 'user-1',
      };

      mockContentItemRepository.findOne.mockResolvedValue(null);

      await expect(service.createAttachment(createDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('queryAttachments', () => {
    it('should return paginated attachments', async () => {
      const queryDto = {
        page: 1,
        pageSize: 10,
      };

      mockAttachmentRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([[mockAttachment], 1]);

      const result = await service.queryAttachments(queryDto);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('deleteAttachment', () => {
    it('should soft delete an attachment', async () => {
      mockAttachmentRepository.findOne.mockResolvedValue(mockAttachment);
      mockAttachmentRepository.update.mockResolvedValue({ affected: 1 });

      await service.deleteAttachment('test-attachment-id');

      expect(mockAttachmentRepository.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when attachment not found', async () => {
      mockAttachmentRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteAttachment('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getContentFile', () => {
    it('should return content file', async () => {
      const buffer = Buffer.from('test content');
      
      mockContentItemRepository.findOne.mockResolvedValue(mockContentItem);
      mockStorageService.retrieve.mockResolvedValue(buffer);

      const result = await service.getContentFile('test-content-id');

      expect(result.buffer).toEqual(buffer);
      expect(result.mimeType).toBe('application/pdf');
      expect(result.name).toBe('Test Document.pdf');
    });

    it('should throw BadRequestException when content has no stored file', async () => {
      const itemWithoutStore = { ...mockContentItem, contentStoreId: null };
      
      mockContentItemRepository.findOne.mockResolvedValue(itemWithoutStore);

      await expect(service.getContentFile('test-content-id')).rejects.toThrow(BadRequestException);
    });
  });

  describe('uploadFile', () => {
    it('should upload file and create content item', async () => {
      const file = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test content'),
      } as Express.Multer.File;

      const uploadResult = {
        storeId: 'store-1',
        storeName: 'local',
        url: '/uploads/test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      };

      mockStorageService.store.mockResolvedValue(uploadResult);
      mockContentItemRepository.create.mockReturnValue(mockContentItem);
      mockContentItemRepository.save.mockResolvedValue(mockContentItem);

      const result = await service.uploadFile(file, { userId: 'user-1' });

      expect(result.name).toBe('Test Document.pdf');
      expect(mockStorageService.store).toHaveBeenCalled();
    });
  });
});
