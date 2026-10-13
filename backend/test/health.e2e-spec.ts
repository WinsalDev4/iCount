import request from 'supertest';

import { createTestApp, type TestApp } from './support/create-test-app.js';

describe('GET /health (e2e)', () => {
  describe('with the database up', () => {
    let testApp: TestApp;

    beforeAll(async () => {
      testApp = await createTestApp();
    });

    afterAll(async () => {
      await testApp.app.close();
    });

    it('answers 200 with the database latency', async () => {
      const response = await request(testApp.app.getHttpServer()).get('/health').expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        checks: { database: { status: 'up', latencyMs: expect.any(Number) } },
      });
    });

    it('is not under the versioned prefix', async () => {
      await request(testApp.app.getHttpServer()).get('/v1/health').expect(404);
    });
  });

  describe('with the database down', () => {
    let testApp: TestApp;

    beforeAll(async () => {
      testApp = await createTestApp({ databaseUrl: 'postgres://icount:icount@127.0.0.1:1/none' });
    });

    afterAll(async () => {
      await testApp.app.close();
    });

    it('answers 503 without leaking the failure reason', async () => {
      const response = await request(testApp.app.getHttpServer()).get('/health').expect(503);

      expect(response.body).toEqual({ status: 'error', checks: { database: { status: 'down' } } });
    });
  });
});
