import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'fs';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TeamsModule } from './teams/teams.module';
import { TopicsModule } from './topics/topics.module';
import { FeedModule } from './feed/feed.module';
import { PostsModule } from './posts/posts.module';
import { SearchModule } from './search/search.module';
import { HashtagsModule } from './hashtags/hashtags.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MatchesModule } from './matches/matches.module';
import { ModerationModule } from './moderation/moderation.module';
import { AdminModule } from './admin/admin.module';

const ADMIN_DIST = join(__dirname, '..', 'admin', 'dist');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Per-IP: 120 requests a minute overall; posting and reporting are tighter (see @Throttle).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    // The moderation dashboard (api/admin, built into admin/dist) is served at /moderation;
    // the admin API itself lives at /admin/*. Skipped when the dashboard was not built.
    ...(existsSync(ADMIN_DIST)
      ? [ServeStaticModule.forRoot({ rootPath: ADMIN_DIST, serveRoot: '/moderation' })]
      : []),
    ModerationModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    TeamsModule,
    TopicsModule,
    FeedModule,
    PostsModule,
    SearchModule,
    HashtagsModule,
    NotificationsModule,
    MatchesModule,
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
