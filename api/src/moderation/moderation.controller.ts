import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportDto } from './dto/report.dto';
import { ModerationService } from './moderation.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ModerationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async report(@CurrentUser() user: { sub: string }, @Body() dto: ReportDto) {
    const viewer = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true },
    });
    if (!viewer) throw new BadRequestException('profile_not_found');
    return this.moderation.report(viewer.id, dto);
  }
}
