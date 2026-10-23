import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PostsController],
})
export class PostsModule {}
