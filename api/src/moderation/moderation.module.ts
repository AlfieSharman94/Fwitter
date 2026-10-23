import { Global, Module } from '@nestjs/common';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

// Global: blocks and hidden posts have to be respected by every module that reads posts.
@Global()
@Module({
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
