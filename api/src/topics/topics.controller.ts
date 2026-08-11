import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('topics')
export class TopicsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async search(@Query('q') q?: string) {
    const query = (q ?? '').trim();

    const items = await this.prisma.topics.findMany({
      where: query
        ? { name: { contains: query, mode: 'insensitive' } }
        : undefined,
      orderBy: { name: 'asc' },
      take: 25,
      select: { id: true, name: true, description: true, icon: true },
    });

    return { topics: items };
  }
}
