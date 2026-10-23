import { BadRequestException, Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PresignDto } from './dto/media.dto';
import { MediaService } from './media.service';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  private async requireViewer(sub: string) {
    const dbUser = await this.prisma.users.findUnique({ where: { cognito_sub: sub }, select: { id: true } });
    if (!dbUser) throw new BadRequestException('profile_not_found');
    return dbUser;
  }

  @Post('presign')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async presign(@CurrentUser() user: { sub: string }, @Body() dto: PresignDto) {
    const viewer = await this.requireViewer(user.sub);
    return this.media.presign(viewer.id, dto);
  }

  @Post(':id/complete')
  async complete(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const viewer = await this.requireViewer(user.sub);
    return this.media.complete(viewer.id, id);
  }
}
