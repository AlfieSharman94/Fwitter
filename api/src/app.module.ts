import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
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
  ],
})
export class AppModule {}
