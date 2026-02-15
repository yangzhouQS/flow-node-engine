/**
 * 内容服务单元测试
 */
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment } from '../entities/attachment.entity';
import { ContentItem, ContentItemType, ContentItemStatus } from '../entities/content-item.entity';
import { ContentService } from './content.service';
import { StorageService } from './storage.service';

describe('ContentService', () => {
  let service: ContentService;
  let contentItemRepository: Repository<ContentItem>;
  let attachmentRepository: Repository<Attachment>;
  let storageService: StorageService;

  const mockContentItem: ContentItem = {
    id: 'test-content-id',
    name: 'Test Document.pdf',
    type: ContentItemType.DOCUMENT,
    mimeType: 'application/pdf',
    size: 1024,
    content: Buffer.from('test content'),
    path: '/uploads/test-document.pdf',
    status: ContentItemStatus.AVAILABLE,
    version: 1,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    processInstanceId: 'process-1',
    taskId: 'task-1',
    tenantId: 'tenant-1',
    metadata: { key: 'value' },
    createTime: new Date(),
    updateTime: new Date(),
    isDeleted: false,
    isArchived: false,
  };

  const mockAttachment: Attachment = {
    id: 'test-attachment-id',
    name: 'Attachment.pdf',
    description: 'Test attachment',
    url: '/contents/test-content-id/download',
    contentItemId: 'test-content-id',
    contentItem: mockContentItem,
    processInstanceId: 'process-1',
    taskId: 'task-1',
    createdBy: 'user-1',
    tenantId: 'tenant-1',
    createTime: new Date(),
    updateTime: new Date(),
    isDeleted: false,
  };

  const mockContentItemRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    softRemove: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getOne: jest.fn(),
    })),
  };

  const mockAttachmentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    softRemove: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getOne: jest.fn(),
    })),
  };

  const mockStorageService = {
    store: jest.fn(),
    retrieve: jest.fn(),
    delete: jest.fn(),
    getSignedUrl: jest.fn(),
  };

  beforeEach(async () => {
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
    jest.clearAllMocks();
  });

  describe('createContentItem', () => {
    it('should successfully create a content item', async () => {
      const createDto = {
        name: 'Test Document.pdf',
        type: ContentItemType.DOCUMENT,
        mimeType: 'application/pdf',
        size: 1024,
        content: Buffer.from('test content'),
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
        size: 1024,
        content: Buffer.from('test content'),
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
      mockContentItemRepository.createQueryBuilder().getOne.mockResolvedValue(mockContentItem);

      const result = await service.findContentItemById('test-content-id');

      expect(result).toEqual(mockContentItem);
    });

    it('should throw NotFoundException when content item not found', async () => {
      mockContentItemRepository.createQueryBuilder().getOne.mockResolvedValue(null);

      await expect(service.findContentItemById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateContentItem', () => {
    it('should successfully update a content item', async () => {
      const updateDto = {
        name: 'Updated Document.pdf',
        updatedBy: 'user-1',
      };

      const updatedItem = { ...mockContentItem, name: 'Updated Document.pdf' };

      mockContentItemRepository.createQueryBuilder().getOne.mockResolvedValue(mockContentItem);
      mockContentItemRepository.save.mockResolvedValue(updatedItem);

      const result = await service.updateContentItem('test-content-id', updateDto);

      expect(result.name).toBe('Updated Document.pdf');
    });
  });

  describe('deleteContentItem', () => {
    it('should soft delete a content item', async () => {
      mockContentItemRepository.createQueryBuilder().getOne.mockResolvedValue(mockContentItem);
      mockContentItemRepository.softRemove.mockResolvedValue(mockContentItem);

      await service.deleteContentItem('test-content-id');

      expect(mockContentItemRepository.softRemove).toHaveBeenCalled();
    });
  });

  describe('archiveContentItem', () => {
    it('should archive a content item', async () => {
      mockContentItemRepository.createQueryBuilder().getOne.mockResolvedValue(mockContentItem);
      mockContentItemRepository.save.mockResolvedValue({ ...mockContentItem, isArchived: true });

      const result = await service.archiveContentItem('test-content-id');

      expect(result.isArchived).toBe(true);
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

      mockContentItemRepository.createQueryBuilder().getOne.mockResolvedValue(mockContentItem);
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

      mockContentItemRepository.createQueryBuilder().getOne.mockResolvedValue(null);

      await expect(service.createAttachment(createDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAttachmentById', () => {
    it('should return an attachment when found', async () => {
      mockAttachmentRepository.createQueryBuilder().getOne.mockResolvedValue(mockAttachment);

      const result = await service.findAttachmentById('test-attachment-id');

      expect(result).toEqual(mockAttachment);
    });

    it('should throw NotFoundException when attachment not found', async () => {
      mockAttachmentRepository.createQueryBuilder().getOne.mockResolvedValue(null);

      await expect(service.findAttachmentById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAttachment', () => {
    it('should soft delete an attachment', async () => {
      mockAttachmentRepository.createQueryBuilder().getOne.mockResolvedValue(mockAttachment);
      mockAttachmentRepository.softRemove.mockResolvedValue(mockAttachment);

      await service.deleteAttachment('test-attachment-id');

      expect(mockAttachmentRepository.softRemove).toHaveBeenCalled();
    });
  });

  describe('getAttachmentsByProcessInstance', () => {
    it('should return attachments for a process instance', async () => {
      mockAttachmentRepository.find.mockResolvedValue([mockAttachment]);

      const result = await service.getAttachmentsByProcessInstance('process-1');

      expect(result).toHaveLength(1);
      expect(result[0].processInstanceId).toBe('process-1');
    });
  });

  describe('getAttachmentsByTask', () => {
    it('should return attachments for a task', async () => {
      mockAttachmentRepository.find.mockResolvedValue([mockAttachment]);

      const result = await service.getAttachmentsByTask('task-1');

      expect(result).toHaveLength(1);
      expect(result[0].taskId).toBe('task-1');
    });
  });

  describe('downloadContent', () => {
    it('should return content for download', async () => {
      mockContentItemRepository.createQueryBuilder().getOne.mockResolvedValue(mockContentItem);

      const result = await service.downloadContent('test-content-id');

      expect(result.content).toEqual(mockContentItem.content);
      expect(result.name).toBe('Test Document.pdf');
      expect(result.mimeType).toBe('application/pdf');
    });

    it('should throw NotFoundException when content not found for download', async () => {
      mockContentItemRepository.createQueryBuilder().getOne.mockResolvedValue(null);

      await expect(service.downloadContent('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getContentUrl', () => {
    it('should return signed URL for content', async () => {
      mockContentItemRepository.createQueryBuilder().getOne.mockResolvedValue(mockContentItem);
      mockStorageService.getSignedUrl.mockResolvedValue('https://storage.example.com/signed-url');

      const result = await service.getContentUrl('test-content-id');

      expect(result).toBe('https://storage.example.com/signed-url');
    });
  });

  describe('getProcessInstanceContents', () => {
    it('should return all content items for a process instance', async () => {
      mockContentItemRepository.find.mockResolvedValue([mockContentItem]);

      const result = await service.getProcessInstanceContents('process-1');

      expect(result).toHaveLength(1);
      expect(result[0].processInstanceId).toBe('process-1');
    });
  });

  describe('getTaskContents', () => {
    it('should return all content items for a task', async () => {
      mockContentItemRepository.find.mockResolvedValue([mockContentItem]);

      const result = await service.getTaskContents('task-1');

      expect(result).toHaveLength(1);
      expect(result[0].taskId).toBe('task-1');
    });
  });
});
