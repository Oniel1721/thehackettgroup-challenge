import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CLOCK_TOKEN } from '../common/tokens/clock.token';
import { SessionService } from './session.service';
import { SESSION_REPOSITORY } from './session.repository.interface';
import { InMemorySessionRepository } from './session.repository.memory';
import { RedisSessionRepository } from './session.repository.redis';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [
    InMemorySessionRepository,
    RedisSessionRepository,
    {
      provide: CLOCK_TOKEN,
      useValue: () => Date.now(),
    },
    {
      provide: SESSION_REPOSITORY,
      inject: [ConfigService, InMemorySessionRepository, RedisSessionRepository],
      useFactory: (
        config: ConfigService,
        memory: InMemorySessionRepository,
        redis: RedisSessionRepository,
      ) => {
        return config.get<string>('SESSION_STORE') === 'redis' ? redis : memory;
      },
    },
    SessionService,
  ],
  exports: [SessionService],
})
export class SessionModule {}
