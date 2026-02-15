/**
 * 内容服务 E2E 测试
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ContentModule } from '../src/content/content.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContentItem, ContentItemType, ContentItemStatus } from '../src/content/entities/content-item.entity';
import { Attachment } from '../src/content/entities/attachment.entity';
import { Repository } from 'typeorm';

describe('ContentController (e2e)', () => {
  let app: INestApplication;
  let contentItemRepository: Repository<ContentItem>;
  let attachmentRepository: Repository<Attachment>;

  const mockContentItem: Partial<ContentItem> = {
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
    processInstanceId: 'process-1',
    taskId: 'task-1',
    tenantId: 'tenant-1',
    createTime: new Date(),
    updateTime: new Date(),
    isDeleted: false,
    isArchived: false,
  };

  const mockAttachment: Partial<Attachment> = {
    id: 'test-attachment-id',
    name: 'Attachment.pdf',
    description: 'Test attachment',
    url: '/contents/test-content-id/download',
    contentItemId: 'test-content-id',
    processInstanceId: 'process-1',
    taskId: 'task-1',
    createdBy: 'user-1',
    tenantId: 'tenant-1',
    createTime: new Date(),
    updateTime: new Date(),
    isDeleted: false,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ContentModule],
    })
      .overrideProvider(getRepositoryToken(ContentItem))
      .useValue({
        create: jest.fn().mockReturnValue(mockContentItem),
        save: jest.fn().mockResolvedValue(mockContentItem),
        findOne: jest.fn().mockResolvedValue(mockContentItem),
        find: jest.fn().mockResolvedValue([mockContentItem]),
        softRemove: jest.fn().mockResolvedValue(mockContentItem),
        createQueryBuilder: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getManyAndCount: jest.fn().mockResolvedValue([[mockContentItem], 1]),
          getOne: jest.fn().mockResolvedValue(mockContentItem),
        })),
      })
      .overrideProvider(getRepositoryToken(Attachment))
      .useValue({
        create: jest.fn().mockReturnValue(mockAttachment),
        save: jest.fn().mockResolvedValue(mockAttachment),
        findOne: jest.fn().mockResolvedValue(mockAttachment),
        find: jest.fn().mockResolvedValue([mockAttachment]),
        softRemove: jest.fn().mockResolvedValue(mockAttachment),
        createQueryBuilder: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getManyAndCount: jest.fn().mockResolvedValue([[mockAttachment], 1]),
          getOne: jest.fn().mockResolvedValue(mockAttachment),
        })),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    contentItemRepository = moduleFixture.get<Repository<ContentItem>>(getRepositoryToken(ContentItem));
    attachmentRepository = moduleFixture.get<Repository<Attachment>>(getRepositoryToken(Attachment));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/contents (POST)', () => {
    it('should create a content item', () => {
      return request(app.getHttpServer())
        .post('/contents')
        .send({
          name: 'Test Document.pdf',
          type: ContentItemType.DOCUMENT,
          mimeType: 'application/pdf',
          size: 1024,
          content: 'dGVzdCBjb250ZW50', // base64 encoded
          createdBy: 'user-1',
        })
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Test Document.pdf');
        });
    });

    it('should validate required fields', () => {
      return request(app.getHttpServer())
        .post('/contents')
        .send({
          name: '', // Empty name should fail validation
        })
        .expect(400);
    });
  });

  describe('/contents (GET)', () => {
    it('should return paginated content items', () => {
      return request(app.getHttpServer())
        .get('/contents')
        .query({ page: 1, pageSize: 10 })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should filter by process instance id', () => {
      return request(app.getHttpServer())
        .get('/contents')
        .query({ processInstanceId: 'process-1' })
        .expect(200)
        .expect(res => {
          expect(res.body.data).toBeDefined();
        });
    });

    it('should filter by task id', () => {
      return request(app.getHttpServer())
        .get('/contents')
        .query({ taskId: 'task-1' })
        .expect(200)
        .expect(res => {
          expect(res.body.data).toBeDefined();
        });
    });
  });

  describe('/contents/:id (GET)', () => {
    it('should return a content item by id', () => {
      return request(app.getHttpServer())
        .get('/contents/test-content-id')
        .expect(200)
        .expect(res => {
          expect(res.body.id).toBe('test-content-id');
          expect(res.body.name).toBe('Test Document.pdf');
        });
    });

    it('should return 404 for non-existent content', () => {
      jest.spyOn(contentItemRepository, 'createQueryBuilder').mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      } as any);

      return request(app.getHttpServer())
        .get('/contents/non-existent-id')
        .expect(404);
    });
  });

  describe('/contents/:id (PUT)', () => {
    it('should update a content item', () => {
      return request(app.getHttpServer())
        .put('/contents/test-content-id')
        .send({
          name: 'Updated Document.pdf',
          updatedBy: 'user-1',
        })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
        });
    });
  });

  describe('/contents/:id (DELETE)', () => {
    it('should delete a content item', () => {
      return request(app.getHttpServer())
        .delete('/contents/test-content-id')
        .expect(204);
    });
  });

  describe('/contents/:id/download (GET)', () => {
    it('should download content', () => {
      return request(app.getHttpServer())
        .get('/contents/test-content-id/download')
        .expect(200);
    });
  });

  describe('/contents/:id/url (GET)', () => {
    it('should get content URL', () => {
      return request(app.getHttpServer())
        .get('/contents/test-content-id/url')
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('url');
        });
    });
  });

  describe('/contents/:id/archive (POST)', () => {
    it('should archive a content item', () => {
      return request(app.getHttpServer())
        .post('/contents/test-content-id/archive')
        .expect(201);
    });
  });

  describe('/contents/process-instance/:processInstanceId (GET)', () => {
    it('should return contents by process instance', () => {
      return request(app.getHttpServer())
        .get('/contents/process-instance/process-1')
        .expect(200)
        .expect(res => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('/contents/task/:taskId (GET)', () => {
    it('should return contents by task', () => {
      return request(app.getHttpServer())
        .get('/contents/task/task-1')
        .expect(200)
        .expect(res => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  // 附件相关测试
  describe('/contents/attachments (POST)', () => {
    it('should create an attachment', () => {
      return request(app.getHttpServer())
        .post('/contents/attachments')
        .send({
          name: 'Attachment.pdf',
          description: 'Test attachment',
          contentItemId: 'test-content-id',
          processInstanceId: 'process-1',
          createdBy: 'user-1',
        })
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Attachment.pdf');
        });
    });
  });

  describe('/contents/attachments/:id (GET)', () => {
    it('should return an attachment by id', () => {
      return request(app.getHttpServer())
        .get('/contents/attachments/test-attachment-id')
        .expect(200)
        .expect(res => {
          expect(res.body.id).toBe('test-attachment-id');
        });
    });
  });

  describe('/contents/attachments/:id (DELETE)', () => {
    it('should delete an attachment', () => {
      return request(app.getHttpServer())
        .delete('/contents/attachments/test-attachment-id')
        .expect(204);
    });
  });

  describe('/contents/attachments/process-instance/:processInstanceId (GET)', () => {
    it('should return attachments by process instance', () => {
      return request(app.getHttpServer())
        .get('/contents/attachments/process-instance/process-1')
        .expect(200)
        .expect(res => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('/contents/attachments/task/:taskId (GET)', () => {
    it('should return attachments by task', () => {
      return request(app.getHttpServer())
        .get('/contents/attachments/task/task-1')
        .expect(200)
        .expect(res => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });
});
