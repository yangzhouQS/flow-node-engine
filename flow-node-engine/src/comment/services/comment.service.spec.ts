/**
 * 评论服务单元测试
 */
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Comment, CommentType } from '../entities/comment.entity';
import { CommentService } from './comment.service';

describe('CommentService', () => {
  let service: CommentService;
  let repository: Repository<Comment>;

  const mockComment: Comment = {
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

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      getMany: jest.fn(),
      getManyAndCount: jest.fn(),
    })),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        {
          provide: getRepositoryToken(Comment),
          useValue: mockRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
    repository = module.get<Repository<Comment>>(getRepositoryToken(Comment));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addComment', () => {
    it('should successfully add a comment', async () => {
      const addDto = {
        userId: 'user-1',
        userName: 'Test User',
        processInstanceId: 'process-1',
        taskId: 'task-1',
        message: 'This is a test comment',
      };

      mockRepository.create.mockReturnValue(mockComment);
      mockRepository.save.mockResolvedValue(mockComment);

      const result = await service.addComment(addDto);

      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockComment);
    });

    it('should throw error when neither processInstanceId nor taskId is provided', async () => {
      const addDto = {
        userId: 'user-1',
        message: 'This is a test comment',
      };

      await expect(service.addComment(addDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw error when parent comment not found', async () => {
      const addDto = {
        userId: 'user-1',
        processInstanceId: 'process-1',
        message: 'This is a reply',
        parentId: 'non-existent-parent',
      };

      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.addComment(addDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateComment', () => {
    it('should successfully update a comment', async () => {
      const updateDto = {
        message: 'Updated message',
      };

      const updatedComment = { ...mockComment, message: 'Updated message', isEdited: true };

      mockRepository.findOne.mockResolvedValue(mockComment);
      mockRepository.createQueryBuilder().getOne.mockResolvedValue(mockComment);
      mockRepository.save.mockResolvedValue(updatedComment);

      const result = await service.updateComment('test-comment-id', updateDto);

      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.message).toBe('Updated message');
      expect(result.isEdited).toBe(true);
    });
  });

  describe('findCommentById', () => {
    it('should return a comment when found', async () => {
      mockRepository.createQueryBuilder().getOne.mockResolvedValue(mockComment);

      const result = await service.findCommentById('test-comment-id');

      expect(result).toEqual(mockComment);
    });

    it('should throw NotFoundException when comment not found', async () => {
      mockRepository.createQueryBuilder().getOne.mockResolvedValue(null);

      await expect(service.findCommentById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteComment', () => {
    it('should soft delete a comment', async () => {
      mockRepository.createQueryBuilder().getOne.mockResolvedValue(mockComment);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      await service.deleteComment('test-comment-id', 'user-1');

      expect(mockRepository.update).toHaveBeenCalledWith(
        'test-comment-id',
        expect.objectContaining({
          isDeleted: true,
          deletedBy: 'user-1',
        })
      );
    });
  });

  describe('likeComment', () => {
    it('should increment like count', async () => {
      const likedComment = { ...mockComment, likeCount: 1 };
      mockRepository.createQueryBuilder().getOne.mockResolvedValue(mockComment);
      mockRepository.save.mockResolvedValue(likedComment);

      const result = await service.likeComment('test-comment-id', false);

      expect(result.likeCount).toBe(1);
    });

    it('should decrement like count when unlike', async () => {
      const commentWithLikes = { ...mockComment, likeCount: 2 };
      const unlikedComment = { ...mockComment, likeCount: 1 };
      mockRepository.createQueryBuilder().getOne.mockResolvedValue(commentWithLikes);
      mockRepository.save.mockResolvedValue(unlikedComment);

      const result = await service.likeComment('test-comment-id', true);

      expect(result.likeCount).toBe(1);
    });

    it('should not go below 0 when unliking', async () => {
      const commentWithZeroLikes = { ...mockComment, likeCount: 0 };
      mockRepository.createQueryBuilder().getOne.mockResolvedValue(commentWithZeroLikes);
      mockRepository.save.mockResolvedValue(commentWithZeroLikes);

      const result = await service.likeComment('test-comment-id', true);

      expect(result.likeCount).toBe(0);
    });
  });

  describe('pinComment', () => {
    it('should pin a comment', async () => {
      const pinnedComment = { ...mockComment, isPinned: true };
      mockRepository.createQueryBuilder().getOne.mockResolvedValue(mockComment);
      mockRepository.save.mockResolvedValue(pinnedComment);

      const result = await service.pinComment('test-comment-id', true);

      expect(result.isPinned).toBe(true);
    });

    it('should unpin a comment', async () => {
      const pinnedComment = { ...mockComment, isPinned: true };
      const unpinnedComment = { ...mockComment, isPinned: false };
      mockRepository.createQueryBuilder().getOne.mockResolvedValue(pinnedComment);
      mockRepository.save.mockResolvedValue(unpinnedComment);

      const result = await service.pinComment('test-comment-id', false);

      expect(result.isPinned).toBe(false);
    });
  });

  describe('addApprovalComment', () => {
    it('should add an approval comment', async () => {
      const approvalComment = {
        ...mockComment,
        type: CommentType.APPROVAL,
        message: 'Approved',
      };

      mockRepository.create.mockReturnValue(approvalComment);
      mockRepository.save.mockResolvedValue(approvalComment);

      const result = await service.addApprovalComment(
        'process-1',
        'task-1',
        'user-1',
        'Approved',
        'Test User'
      );

      expect(result.type).toBe(CommentType.APPROVAL);
      expect(result.message).toBe('Approved');
    });
  });

  describe('addRejectComment', () => {
    it('should add a reject comment', async () => {
      const rejectComment = {
        ...mockComment,
        type: CommentType.REJECT,
        message: 'Rejected',
      };

      mockRepository.create.mockReturnValue(rejectComment);
      mockRepository.save.mockResolvedValue(rejectComment);

      const result = await service.addRejectComment(
        'process-1',
        'task-1',
        'user-1',
        'Rejected',
        'Test User'
      );

      expect(result.type).toBe(CommentType.REJECT);
      expect(result.message).toBe('Rejected');
    });
  });

  describe('addSystemComment', () => {
    it('should add a system comment', async () => {
      const systemComment = {
        ...mockComment,
        userId: 'system',
        userName: '系统',
        type: CommentType.SYSTEM,
        message: 'Process started',
      };

      mockRepository.create.mockReturnValue(systemComment);
      mockRepository.save.mockResolvedValue(systemComment);

      const result = await service.addSystemComment(
        'process-1',
        'task-1',
        'Process started',
        'tenant-1'
      );

      expect(result.userId).toBe('system');
      expect(result.type).toBe(CommentType.SYSTEM);
    });
  });

  describe('getCommentStats', () => {
    it('should return comment statistics', async () => {
      const comments = [
        { ...mockComment, type: CommentType.COMMENT, parentId: null, userId: 'user-1', userName: 'User 1' },
        { ...mockComment, type: CommentType.APPROVAL, parentId: 'parent-1', userId: 'user-2', userName: 'User 2' },
        { ...mockComment, type: CommentType.COMMENT, parentId: null, userId: 'user-1', userName: 'User 1' },
      ];

      mockRepository.createQueryBuilder().getMany.mockResolvedValue(comments);
      mockRepository.createQueryBuilder().where.mockReturnThis();
      mockRepository.createQueryBuilder().andWhere.mockReturnThis();

      const result = await service.getCommentStats('process-1');

      expect(result.totalComments).toBe(2); // 2 root comments
      expect(result.totalReplies).toBe(1); // 1 reply
      expect(result.byType[CommentType.COMMENT]).toBe(2);
      expect(result.byType[CommentType.APPROVAL]).toBe(1);
    });
  });
});
