import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { LinksModule } from '../links/links.module';
import { ConsentController } from './consent.controller';
import { ConsentService } from './consent.service';

@Module({
  imports: [NotificationsModule, LinksModule],
  controllers: [ConsentController],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
