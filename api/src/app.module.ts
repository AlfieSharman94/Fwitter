import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TeamsModule } from './teams/teams.module';
import { TopicsModule } from './topics/topics.module';
import { FeedModule } from './feed/feed.module';
import { PostsModule } from './posts/posts.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TeamsModule,
    TopicsModule,
    FeedModule,
    PostsModule,
    SearchModule,
  ],
})
export class AppModule {}
