import { GoneException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CLOCK_TOKEN } from '../common/tokens/clock.token';
import { SESSION_REPOSITORY } from './session.repository.interface';
import { SessionService } from './session.service';
import { Session, Turn } from '../common/types/chat.types';

const THIRTY_MIN_MS = 30 * 60 * 1000;

// ── SessionRepository mock ────────────────────────────────────────────────────
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

describe('SessionService', () => {
  let service: SessionService;
  let mockClock: jest.Mock<number>;
  let repoMock: ReturnType<typeof makeRepositoryMock>;

  beforeEach(async () => {
    mockClock = jest.fn(() => 1_000_000);
    repoMock = makeRepositoryMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: CLOCK_TOKEN, useValue: mockClock },
        { provide: SESSION_REPOSITORY, useValue: repoMock },
      ],
    }).compile();

    service = module.get(SessionService);
  });

  describe('createSession', () => {
    it('returns a UUID string', async () => {
      const id = await service.createSession();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('each call returns a unique id', async () => {
      const a = await service.createSession();
      const b = await service.createSession();
      expect(a).not.toBe(b);
    });
  });

  describe('getTurns', () => {
    it('returns empty array for a fresh session', async () => {
      const id = await service.createSession();
      expect(await service.getTurns(id)).toEqual([]);
    });

    it('throws NotFoundException for unknown sessionId', async () => {
      await expect(service.getTurns('unknown-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addTurn', () => {
    it('appends turns and returns them via getTurns', async () => {
      const id = await service.createSession();
      const turn: Turn = { role: 'user', content: 'hello', timestamp: 1 };
      await service.addTurn(id, turn);
      expect(await service.getTurns(id)).toEqual([turn]);
    });

    it('updates lastActivity on addTurn', async () => {
      const id = await service.createSession();
      mockClock.mockReturnValue(2_000_000);
      await service.addTurn(id, { role: 'user', content: 'hi', timestamp: 2_000_000 });
      // Should not throw — lastActivity was updated
      mockClock.mockReturnValue(2_000_000 + THIRTY_MIN_MS - 1);
      await expect(service.getTurns(id)).resolves.toBeDefined();
    });
  });

  describe('session expiry', () => {
    it('throws GoneException when idle for more than 30 minutes', async () => {
      const id = await service.createSession();
      mockClock.mockReturnValue(1_000_000 + THIRTY_MIN_MS + 1);
      await expect(service.getTurns(id)).rejects.toThrow(GoneException);
    });

    it('does not expire when idle for exactly 30 minutes', async () => {
      const id = await service.createSession();
      mockClock.mockReturnValue(1_000_000 + THIRTY_MIN_MS);
      await expect(service.getTurns(id)).resolves.toBeDefined();
    });
  });

  describe('deleteSession', () => {
    it('removes a session so subsequent calls throw NotFoundException', async () => {
      const id = await service.createSession();
      await service.deleteSession(id);
      await expect(service.getTurns(id)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when deleting unknown session', async () => {
      await expect(service.deleteSession('no-such-id')).rejects.toThrow(NotFoundException);
    });
  });
});
