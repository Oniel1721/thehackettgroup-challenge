import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ChatModule } from './chat.module';
import { LlmService } from '../llm/llm.service';
import { CLOCK_TOKEN } from '../common/tokens/clock.token';
import { SESSION_REPOSITORY } from '../session/session.repository.interface';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Session } from '../common/types/chat.types';

const THIRTY_MIN_MS = 30 * 60 * 1000;

function makeRepositoryMock() {
  const store = new Map<string, Session>();
  return {
    save: jest.fn(async (session: Session) => { store.set(session.id, structuredClone(session)); }),
    findById: jest.fn(async (id: string) => {
      const s = store.get(id);
      return s ? structuredClone(s) : null;
    }),
    delete: jest.fn(async (id: string) => { const had = store.has(id); store.delete(id); return had; }),
    exists: jest.fn(async (id: string) => store.has(id)),
  };
}

describe('ChatController (integration)', () => {
  let app: INestApplication;
  let mockClock: jest.Mock<number>;

  // A minimal LlmService stub so we never hit the real Anthropic API
  const llmServiceStub = {
    streamReply: jest.fn(async function* () {
      yield 'Hello ';
      yield 'world';
    }),
  };

  beforeEach(async () => {
    mockClock = jest.fn(() => Date.now());

    const module: TestingModule = await Test.createTestingModule({
      imports: [ChatModule],
    })
      .overrideProvider(LlmService)
      .useValue(llmServiceStub)
      .overrideProvider(CLOCK_TOKEN)
      .useValue(mockClock)
      .overrideProvider(SESSION_REPOSITORY)
      .useValue(makeRepositoryMock())
      .overrideProvider(REDIS_CLIENT)
      .useValue({})
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('POST /chat/session', () => {
    it('returns 201 with a sessionId', async () => {
      const res = await request(app.getHttpServer())
        .post('/chat/session')
        .expect(201);

      expect(res.body).toHaveProperty('sessionId');
      expect(typeof res.body.sessionId).toBe('string');
    });
  });

  describe('POST /chat/:sessionId/message', () => {
    it('streams SSE with correct Content-Type', async () => {
      const { body: session } = await request(app.getHttpServer())
        .post('/chat/session')
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/chat/${session.sessionId}/message`)
        .send({ message: 'hello' });

      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.text).toContain('data:');
      expect(res.text).toContain('"done":true');
    });

    it('returns 404 for an unknown sessionId', async () => {
      const res = await request(app.getHttpServer())
        .post('/chat/unknown-session-id/message')
        .send({ message: 'hello' });

      // With SSE the error is streamed, not an HTTP error code
      // The controller catches and writes { error } to the stream
      expect(res.text).toContain('error');
    });

    it('returns 400 when message is empty', async () => {
      const { body: session } = await request(app.getHttpServer())
        .post('/chat/session')
        .expect(201);

      await request(app.getHttpServer())
        .post(`/chat/${session.sessionId}/message`)
        .send({ message: '' })
        .expect(400);
    });

    it('returns 410 for an expired session', async () => {
      const now = Date.now();
      mockClock.mockReturnValue(now);

      const { body: session } = await request(app.getHttpServer())
        .post('/chat/session')
        .expect(201);

      // Advance clock past TTL
      mockClock.mockReturnValue(now + THIRTY_MIN_MS + 1);

      const res = await request(app.getHttpServer())
        .post(`/chat/${session.sessionId}/message`)
        .send({ message: 'hello' });

      // Expired sessions emit error in the stream
      expect(res.text).toContain('error');
    });
  });

  describe('GET /chat/:sessionId/history', () => {
    it('returns turns array', async () => {
      const { body: session } = await request(app.getHttpServer())
        .post('/chat/session')
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/chat/${session.sessionId}/history`)
        .expect(200);

      expect(res.body).toHaveProperty('turns');
      expect(Array.isArray(res.body.turns)).toBe(true);
    });

    it('returns 404 for unknown sessionId', async () => {
      await request(app.getHttpServer())
        .get('/chat/no-such-session/history')
        .expect(404);
    });
  });

  describe('DELETE /chat/:sessionId', () => {
    it('returns 204 and removes the session', async () => {
      const { body: session } = await request(app.getHttpServer())
        .post('/chat/session')
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/chat/${session.sessionId}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/chat/${session.sessionId}/history`)
        .expect(404);
    });
  });
});
