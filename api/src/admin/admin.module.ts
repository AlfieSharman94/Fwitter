import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { DmModule } from '../dm/dm.module';

@Module({
  imports: [NotificationsModule, DmModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
