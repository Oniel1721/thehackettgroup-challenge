import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Session } from '../common/types/chat.types';
import { ISessionRepository } from './session.repository.interface';

const SESSION_TTL_S = 30 * 60; // 30 minutes

@Injectable()
export class RedisSessionRepository implements ISessionRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(id: string): string {
    return `session:${id}`;
  }

  async save(session: Session): Promise<void> {
    await this.redis.set(this.key(session.id), JSON.stringify(session), 'EX', SESSION_TTL_S);
  }

  async findById(id: string): Promise<Session | null> {
    const raw = await this.redis.get(this.key(id));
    return raw ? (JSON.parse(raw) as Session) : null;
  }

  async delete(id: string): Promise<boolean> {
    const count = await this.redis.del(this.key(id));
    return count > 0;
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.redis.exists(this.key(id));
    return count > 0;
  }
}
