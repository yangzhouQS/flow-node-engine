/**
 * 评论服务 E2E 测试
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { CommentModule } from '../src/comment/comment.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Comment, CommentType } from '../src/comment/entities/comment.entity';
import { Repository } from 'typeorm';

describe('CommentController (e2e)', () => {
  let app: INestApplication;
  let commentRepository: Repository<Comment>;

  const mockComment: Partial<Comment> = {
    id: 'test-comment-id',
    userId: 'user-1',
    userName: 'Test User',
    processInstanceId: 'process-1',
    taskId: 'task-1',
    type: CommentType.COMMENT,
    message: 'This is a test comment',
    parentId: null,
    rootId: null,
    replyToUserId: null,
    replyToUserName: null,
    likeCount: 0,
    replyCount: 0,
    isEdited: false,
    isPinned: false,
    isInternal: false,
    isDeleted: false,
    deleteTime: null,
    deletedBy: null,
    tenantId: 'tenant-1',
    metadata: null,
    createTime: new Date(),
    updateTime: new Date(),
  };

  const mockReply: Partial<Comment> = {
    id: 'test-reply-id',
    userId: 'user-2',
    userName: 'Reply User',
    processInstanceId: 'process-1',
    taskId: 'task-1',
    type: CommentType.COMMENT,
    message: 'This is a reply',
    parentId: 'test-comment-id',
    rootId: 'test-comment-id',
    replyToUserId: 'user-1',
    replyToUserName: 'Test User',
    likeCount: 0,
    replyCount: 0,
    isEdited: false,
    isPinned: false,
    isInternal: false,
    isDeleted: false,
    tenantId: 'tenant-1',
    createTime: new Date(),
    updateTime: new Date(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CommentModule],
    })
      .overrideProvider(getRepositoryToken(Comment))
      .useValue({
        create: jest.fn().mockImplementation((dto) => ({ ...mockComment, ...dto })),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
        findOne: jest.fn().mockResolvedValue(mockComment),
        find: jest.fn().mockResolvedValue([mockComment]),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        increment: jest.fn().mockResolvedValue({ affected: 1 }),
        decrement: jest.fn().mockResolvedValue({ affected: 1 }),
        createQueryBuilder: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          addOrderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getManyAndCount: jest.fn().mockResolvedValue([[mockComment], 1]),
          getMany: jest.fn().mockResolvedValue([mockComment]),
          getOne: jest.fn().mockResolvedValue(mockComment),
        })),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    commentRepository = moduleFixture.get<Repository<Comment>>(getRepositoryToken(Comment));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/comments (POST)', () => {
    it('should create a comment', () => {
      return request(app.getHttpServer())
        .post('/comments')
        .send({
          userId: 'user-1',
          userName: 'Test User',
          processInstanceId: 'process-1',
          taskId: 'task-1',
          message: 'This is a test comment',
        })
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.message).toBe('This is a test comment');
        });
    });

    it('should require either processInstanceId or taskId', () => {
      return request(app.getHttpServer())
        .post('/comments')
        .send({
          userId: 'user-1',
          message: 'This is a test comment',
        })
        .expect(500); // Will throw BadRequestException
    });

    it('should validate message is required', () => {
      return request(app.getHttpServer())
        .post('/comments')
        .send({
          userId: 'user-1',
          processInstanceId: 'process-1',
        })
        .expect(400);
    });
  });

  describe('/comments (GET)', () => {
    it('should return paginated comments', () => {
      return request(app.getHttpServer())
        .get('/comments')
        .query({ page: 1, pageSize: 20 })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should filter by process instance id', () => {
      return request(app.getHttpServer())
        .get('/comments')
        .query({ processInstanceId: 'process-1' })
        .expect(200)
        .expect(res => {
          expect(res.body.data).toBeDefined();
        });
    });

    it('should filter by task id', () => {
      return request(app.getHttpServer())
        .get('/comments')
        .query({ taskId: 'task-1' })
        .expect(200)
        .expect(res => {
          expect(res.body.data).toBeDefined();
        });
    });

    it('should filter by type', () => {
      return request(app.getHttpServer())
        .get('/comments')
        .query({ type: CommentType.COMMENT })
        .expect(200)
        .expect(res => {
          expect(res.body.data).toBeDefined();
        });
    });
  });

  describe('/comments/:id (GET)', () => {
    it('should return a comment by id', () => {
      return request(app.getHttpServer())
        .get('/comments/test-comment-id')
        .expect(200)
        .expect(res => {
          expect(res.body.id).toBe('test-comment-id');
          expect(res.body.message).toBe('This is a test comment');
        });
    });

    it('should return 404 for non-existent comment', () => {
      jest.spyOn(commentRepository, 'createQueryBuilder').mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      } as any);

      return request(app.getHttpServer())
        .get('/comments/non-existent-id')
        .expect(404);
    });
  });

  describe('/comments/:id (PUT)', () => {
    it('should update a comment', () => {
      return request(app.getHttpServer())
        .put('/comments/test-comment-id')
        .send({
          message: 'Updated comment message',
        })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
        });
    });
  });

  describe('/comments/:id (DELETE)', () => {
    it('should delete a comment', () => {
      return request(app.getHttpServer())
        .delete('/comments/test-comment-id')
        .expect(204);
    });
  });

  describe('/comments/:id/like (POST)', () => {
    it('should like a comment', () => {
      return request(app.getHttpServer())
        .post('/comments/test-comment-id/like')
        .send({
          userId: 'user-2',
        })
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
        });
    });

    it('should unlike a comment', () => {
      return request(app.getHttpServer())
        .post('/comments/test-comment-id/like')
        .send({
          userId: 'user-2',
          unlike: true,
        })
        .expect(201);
    });
  });

  describe('/comments/:id/pin (PUT)', () => {
    it('should pin a comment', () => {
      return request(app.getHttpServer())
        .put('/comments/test-comment-id/pin')
        .send({
          pinned: true,
        })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
        });
    });

    it('should unpin a comment', () => {
      return request(app.getHttpServer())
        .put('/comments/test-comment-id/pin')
        .send({
          pinned: false,
        })
        .expect(200);
    });
  });

  describe('/comments/stats/overview (GET)', () => {
    it('should return comment statistics', () => {
      return request(app.getHttpServer())
        .get('/comments/stats/overview')
        .query({ processInstanceId: 'process-1' })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('totalComments');
          expect(res.body).toHaveProperty('totalReplies');
          expect(res.body).toHaveProperty('byType');
        });
    });
  });

  describe('/comments/process-instance/:processInstanceId/tree (GET)', () => {
    it('should return comment tree for process instance', () => {
      return request(app.getHttpServer())
        .get('/comments/process-instance/process-1/tree')
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
        });
    });
  });

  describe('/comments/process-instance/:processInstanceId (GET)', () => {
    it('should return comments for process instance', () => {
      return request(app.getHttpServer())
        .get('/comments/process-instance/process-1')
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });

  describe('/comments/task/:taskId/tree (GET)', () => {
    it('should return comment tree for task', () => {
      return request(app.getHttpServer())
        .get('/comments/task/task-1/tree')
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
        });
    });
  });

  describe('/comments/task/:taskId (GET)', () => {
    it('should return comments for task', () => {
      return request(app.getHttpServer())
        .get('/comments/task/task-1')
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });

  describe('/comments/approval (POST)', () => {
    it('should add an approval comment', () => {
      return request(app.getHttpServer())
        .post('/comments/approval')
        .send({
          processInstanceId: 'process-1',
          taskId: 'task-1',
          userId: 'user-1',
          message: 'Approved',
          userName: 'Test User',
        })
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.type).toBe(CommentType.APPROVAL);
        });
    });
  });

  describe('/comments/reject (POST)', () => {
    it('should add a reject comment', () => {
      return request(app.getHttpServer())
        .post('/comments/reject')
        .send({
          processInstanceId: 'process-1',
          taskId: 'task-1',
          userId: 'user-1',
          message: 'Rejected',
          userName: 'Test User',
        })
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.type).toBe(CommentType.REJECT);
        });
    });
  });

  describe('/comments/system (POST)', () => {
    it('should add a system comment', () => {
      return request(app.getHttpServer())
        .post('/comments/system')
        .send({
          processInstanceId: 'process-1',
          taskId: 'task-1',
          message: 'Process started',
          tenantId: 'tenant-1',
        })
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.type).toBe(CommentType.SYSTEM);
          expect(res.body.userId).toBe('system');
        });
    });
  });
});
