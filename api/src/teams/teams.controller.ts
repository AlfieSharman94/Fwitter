import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('teams')
export class TeamsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async search(@Query('q') q?: string) {
    const query = (q ?? '').trim();

    const items = await this.prisma.teams.findMany({
      where: query
        ? { name: { contains: query, mode: 'insensitive' } }
        : undefined,
      orderBy: { name: 'asc' },
      take: 25,
      select: { id: true, name: true, logo_url: true },
    });

    return { teams: items };
  }
}
