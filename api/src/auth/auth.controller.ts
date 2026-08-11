import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('username-available')
  async usernameAvailable(@Query('username') username?: string) {
    const u = (username ?? '').trim();

    // Match your onboarding rules (adjust if you want)
    if (!u || u.length < 2 || u.length > 30 || !/^[a-zA-Z0-9_]+$/.test(u)) {
      return { available: false, reason: 'invalid_format' as const };
    }

    // NOTE: prisma model name depends on introspection; likely `users`
    const existing = await this.prisma.users.findFirst({
      where: { username: { equals: u, mode: 'insensitive' } },
      select: { id: true },
    });

    return { available: !existing };
  }

  @Get('email-available')
  async emailAvailable(@Query('email') email?: string) {
    const e = (email ?? '').trim().toLowerCase();

    if (!e || e.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return { available: false, reason: 'invalid_format' as const };
    }

    const existing = await this.prisma.users.findFirst({
      where: { email: { equals: e, mode: 'insensitive' } },
      select: { id: true },
    });

    return { available: !existing };
  }
}
