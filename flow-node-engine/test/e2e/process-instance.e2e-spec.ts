import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { createTestApp } from '../utils/test-utils';

describe('Process Instance API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = await createTestApp(moduleFixture, {
      useValidationPipe: true,
      useGlobalPrefix: 'api',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/process-instances (POST)', () => {
    it('should create a new process instance', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/process-instances')
        .send({
          processDefinitionKey: 'simple_approval_process',
          businessKey: 'test-biz-001',
          variables: {
            applicant: 'user-001',
            amount: 10000,
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('processDefinitionKey', 'simple_approval_process');
      expect(response.body).toHaveProperty('businessKey', 'test-biz-001');
    });

    it('should return 400 for invalid request', async () => {
      await request(app.getHttpServer())
        .post('/api/process-instances')
        .send({
          // Missing required fields
        })
        .expect(400);
    });
  });

  describe('/api/process-instances/:id (GET)', () => {
    it('should return a process instance by id', async () => {
      // First create a process instance
      const createResponse = await request(app.getHttpServer())
        .post('/api/process-instances')
        .send({
          processDefinitionKey: 'simple_approval_process',
          businessKey: 'test-biz-002',
        });

      const processInstanceId = createResponse.body.id;

      // Then fetch it
      const response = await request(app.getHttpServer())
        .get(`/api/process-instances/${processInstanceId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', processInstanceId);
    });

    it('should return 404 for non-existent process instance', async () => {
      await request(app.getHttpServer())
        .get('/api/process-instances/non-existent-id')
        .expect(404);
    });
  });

  describe('/api/process-instances/:id/tasks (GET)', () => {
    it('should return active tasks for a process instance', async () => {
      // First create a process instance
      const createResponse = await request(app.getHttpServer())
        .post('/api/process-instances')
        .send({
          processDefinitionKey: 'simple_approval_process',
          businessKey: 'test-biz-003',
        });

      const processInstanceId = createResponse.body.id;

      // Then fetch its tasks
      const response = await request(app.getHttpServer())
        .get(`/api/process-instances/${processInstanceId}/tasks`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
