import { Injectable } from '@nestjs/common';
import { Session } from '../common/types/chat.types';
import { ISessionRepository } from './session.repository.interface';

@Injectable()
export class InMemorySessionRepository implements ISessionRepository {
  private readonly store = new Map<string, Session>();

  async save(session: Session): Promise<void> {
    this.store.set(session.id, structuredClone(session));
  }

  async findById(id: string): Promise<Session | null> {
    const session = this.store.get(id);
    return session ? structuredClone(session) : null;
  }

  async delete(id: string): Promise<boolean> {
    const had = this.store.has(id);
    this.store.delete(id);
    return had;
  }

  async exists(id: string): Promise<boolean> {
    return this.store.has(id);
  }
}
