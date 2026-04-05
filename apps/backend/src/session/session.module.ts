import { Module } from '@nestjs/common';
import { CLOCK_TOKEN } from '../common/tokens/clock.token';
import { SessionService } from './session.service';

@Module({
  providers: [
    SessionService,
    {
      provide: CLOCK_TOKEN,
      useValue: () => Date.now(),
    },
  ],
  exports: [SessionService],
})
export class SessionModule {}
