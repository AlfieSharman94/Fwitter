import { Controller, Get, Logger, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { PrismaService } from '../prisma/prisma.service';

// Both checks are unauthenticated by necessity (they run during sign-up), so they are
// throttled per IP to keep them from being used to enumerate accounts in bulk.
@Controller('auth')
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly cognito: CognitoIdentityProviderClient;
  private readonly userPoolId: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.cognito = new CognitoIdentityProviderClient({ region: config.get<string>('AWS_REGION') ?? 'eu-north-1' });
    this.userPoolId = config.get<string>('COGNITO_USER_POOL_ID') ?? '';
  }

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

    // Quotes and backslashes are also refused so the address can go into a Cognito filter as is.
    if (!e || e.length > 255 || !/^[^\s@"\\]+@[^\s@"\\]+\.[^\s@"\\]+$/.test(e)) {
      return { available: false, reason: 'invalid_format' as const };
    }

    const existing = await this.prisma.users.findFirst({
      where: { email: { equals: e, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) return { available: false };

    // The profile table is only half the story: the login lives in Cognito, and an address can
    // have one without a profile (a sign-up that never finished, or a rebuilt database). Those
    // people need to sign in, not sign up, so say so here rather than at the last step.
    if (await this.hasCognitoLogin(e)) return { available: false, reason: 'existing_login' as const };

    return { available: true };
  }

  private async hasCognitoLogin(email: string): Promise<boolean> {
    if (!this.userPoolId) return false;
    try {
      const res = await this.cognito.send(
        new ListUsersCommand({ UserPoolId: this.userPoolId, Filter: `email = "${email}"`, Limit: 1 }),
      );
      return (res.Users?.length ?? 0) > 0;
    } catch (e) {
      // Without cognito-idp:ListUsers the check degrades to the database answer; the final
      // onboarding step still catches the duplicate, just later.
      this.logger.warn(`email-available: Cognito lookup failed: ${(e as Error)?.message ?? e}`);
      return false;
    }
  }
}
