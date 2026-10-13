import request from 'supertest';

import { createTestApp, type TestApp } from './support/create-test-app.js';

describe('HTTP cross-cutting concerns (e2e)', () => {
  let testApp: TestApp;
  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('serves the OpenAPI document with the ProblemDetails schema', async () => {
    const response = await http().get('/docs/json').expect(200);

    expect(response.body.info).toMatchObject({ title: 'iCount API', version: '1' });
    expect(Object.keys(response.body.paths)).toEqual(
      expect.arrayContaining(['/health', '/v1/notes', '/v1/notes/{id}']),
    );
    expect(response.body.components.schemas.ProblemDetails).toBeDefined();
  });

  it('serves Swagger UI', async () => {
    await http().get('/docs').expect(200).expect('content-type', /html/);
  });

  it('renders unknown routes as RFC 9457 problems', async () => {
    const response = await http()
      .get('/v1/nope')
      .expect(404)
      .expect('content-type', /application\/problem\+json/);

    expect(response.body).toMatchObject({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      instance: '/v1/nope',
    });
  });

  it('propagates the caller request id for tracing', async () => {
    const response = await http().get('/health').set('x-request-id', 'trace-123').expect(200);

    expect(response.headers['x-request-id']).toBe('trace-123');
  });

  it('does not mount the template module in production', async () => {
    const production = await createTestApp({ nodeEnv: 'production' });
    try {
      await request(production.app.getHttpServer()).get('/health').expect(200);
      await request(production.app.getHttpServer()).post('/v1/notes').send({}).expect(404);
    } finally {
      await production.app.close();
    }
  });
});
