import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../app.js';
import type { Express } from 'express';

describe('Swagger UI Integration Tests', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /api-docs', () => {
    it('应该返回 Swagger UI HTML 页面', async () => {
      const response = await request(app).get('/api-docs/');

      // Swagger UI 应该返回 HTML 内容
      expect(response.status).toBe(200);
    });

    it('应该能够访问 Swagger UI 资源', async () => {
      const response = await request(app).get('/api-docs/swagger-ui.css');

      // 应该能够访问 Swagger UI 的静态资源
      expect([200, 304]).toContain(response.status);
    });
  });

  describe('API Documentation Endpoint', () => {
    it('应该在根 API 端点提供文档链接', async () => {
      const response = await request(app).get('/api');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.documentation).toBe('/api/docs');
    });
  });
});
