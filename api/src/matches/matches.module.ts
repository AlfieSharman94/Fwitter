import { Module } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { FixturesSyncService } from './fixtures-sync.service';

@Module({
  controllers: [MatchesController],
  providers: [FixturesSyncService],
})
export class MatchesModule {}
