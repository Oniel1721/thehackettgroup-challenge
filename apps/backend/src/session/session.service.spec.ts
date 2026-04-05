import { GoneException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CLOCK_TOKEN } from '../common/tokens/clock.token';
import { SessionService } from './session.service';

const THIRTY_MIN_MS = 30 * 60 * 1000;

describe('SessionService', () => {
  let service: SessionService;
  let mockClock: jest.Mock<number>;

  beforeEach(async () => {
    mockClock = jest.fn(() => 1_000_000);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: CLOCK_TOKEN, useValue: mockClock },
      ],
    }).compile();

    service = module.get(SessionService);
  });

  describe('createSession', () => {
    it('returns a UUID string', () => {
      const id = service.createSession();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('each call returns a unique id', () => {
      const a = service.createSession();
      const b = service.createSession();
      expect(a).not.toBe(b);
    });
  });

  describe('getTurns', () => {
    it('returns empty array for a fresh session', () => {
      const id = service.createSession();
      expect(service.getTurns(id)).toEqual([]);
    });

    it('throws NotFoundException for unknown sessionId', () => {
      expect(() => service.getTurns('unknown-id')).toThrow(NotFoundException);
    });
  });

  describe('addTurn', () => {
    it('appends turns and returns them via getTurns', () => {
      const id = service.createSession();
      const turn = { role: 'user' as const, content: 'hello', timestamp: 1 };
      service.addTurn(id, turn);
      expect(service.getTurns(id)).toEqual([turn]);
    });

    it('updates lastActivity on addTurn', () => {
      const id = service.createSession();
      mockClock.mockReturnValue(2_000_000);
      service.addTurn(id, {
        role: 'user',
        content: 'hi',
        timestamp: 2_000_000,
      });
      // Should not throw — lastActivity was updated
      mockClock.mockReturnValue(2_000_000 + THIRTY_MIN_MS - 1);
      expect(() => service.getTurns(id)).not.toThrow();
    });
  });

  describe('session expiry', () => {
    it('throws GoneException when idle for more than 30 minutes', () => {
      const id = service.createSession();
      // Advance clock past TTL
      mockClock.mockReturnValue(1_000_000 + THIRTY_MIN_MS + 1);
      expect(() => service.getTurns(id)).toThrow(GoneException);
    });

    it('does not expire when idle for exactly 30 minutes', () => {
      const id = service.createSession();
      mockClock.mockReturnValue(1_000_000 + THIRTY_MIN_MS);
      expect(() => service.getTurns(id)).not.toThrow();
    });
  });

  describe('deleteSession', () => {
    it('removes a session so subsequent calls throw NotFoundException', () => {
      const id = service.createSession();
      service.deleteSession(id);
      expect(() => service.getTurns(id)).toThrow(NotFoundException);
    });

    it('throws NotFoundException when deleting unknown session', () => {
      expect(() => service.deleteSession('no-such-id')).toThrow(
        NotFoundException,
      );
    });
  });
});
