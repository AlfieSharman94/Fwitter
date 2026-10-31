import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';

@Module({
  imports: [NotificationsModule],
  controllers: [LinksController],
  providers: [LinksService],
  exports: [LinksService],
})
export class LinksModule {}
