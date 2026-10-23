import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { DmModule } from '../dm/dm.module';
import { ConsentModule } from '../consent/consent.module';

@Module({
  imports: [NotificationsModule, DmModule, ConsentModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
