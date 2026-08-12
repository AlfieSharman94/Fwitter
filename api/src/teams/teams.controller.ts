import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('teams')
export class TeamsController {
  constructor(private readonly prisma: PrismaService) {}

  // No auth guard: onboarding calls this before the account is confirmed/signed in
  // (same reasoning as /auth/username-available and /auth/email-available).
  @Get('search')
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
