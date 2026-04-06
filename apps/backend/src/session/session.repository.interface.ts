import { Session, Turn } from '../common/types/chat.types';

export interface ISessionRepository {
  save(session: Session): Promise<void>;
  findById(id: string): Promise<Session | null>;
  delete(id: string): Promise<boolean>;
  exists(id: string): Promise<boolean>;
}

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
