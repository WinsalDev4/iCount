import request from 'supertest';

import { createTestApp, type SignedInUser, type TestApp } from './support/create-test-app.js';

/** End to end through HTTP, validation, use cases, Drizzle and PostgreSQL. */
describe('/v1/notes (e2e, template module)', () => {
  let testApp: TestApp;
  let user: SignedInUser;
  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createTestApp();
    user = await testApp.signIn();
  });

  beforeEach(async () => {
    await testApp.truncate('notes');
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('requires an access token', async () => {
    const response = await http().post('/v1/notes').send({ text: 'hola' }).expect(401);

    expect(response.body).toMatchObject({ status: 401, title: 'Unauthorized' });
  });

  it('creates a note and reads it back from the database', async () => {
    const created = await http()
      .post('/v1/notes')
      .set(user.headers)
      .send({ text: '  pagar la luz ' })
      .expect(201);

    expect(created.body).toEqual({
      id: expect.any(String),
      text: 'pagar la luz',
      createdAt: expect.any(String),
    });

    const fetched = await http().get(`/v1/notes/${created.body.id}`).set(user.headers).expect(200);
    expect(fetched.body).toEqual(created.body);
  });

  it('rejects an invalid body with a 400 problem listing every field', async () => {
    const response = await http()
      .post('/v1/notes')
      .set(user.headers)
      .send({ text: '', extra: true })
      .expect(400)
      .expect('content-type', /application\/problem\+json/);

    expect(response.body).toMatchObject({
      type: '/problems/validation-error',
      status: 400,
      instance: '/v1/notes',
      traceId: expect.any(String),
    });
    expect(response.body.errors.map((e: { pointer: string }) => e.pointer).sort()).toEqual([
      '#/',
      '#/text',
    ]);
  });

  it('rejects a malformed id in the path', async () => {
    const response = await http().get('/v1/notes/not-a-uuid').set(user.headers).expect(400);

    expect(response.body.errors).toEqual([
      expect.objectContaining({ in: 'path', pointer: '#/id' }),
    ]);
  });

  it('answers 404 with a domain problem for a missing note', async () => {
    const response = await http()
      .get('/v1/notes/0199e0a4-0000-7000-8000-000000000000')
      .set(user.headers)
      .expect(404)
      .expect('content-type', /application\/problem\+json/);

    expect(response.body).toMatchObject({
      type: '/problems/note-not-found',
      title: 'Note not found',
      status: 404,
    });
  });
});
