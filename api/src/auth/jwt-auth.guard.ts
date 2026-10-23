import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ModerationService } from '../moderation/moderation.service';
import { ALLOW_PENDING_CONSENT_KEY } from './allow-pending-consent.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly moderation: ModerationService,
    private readonly reflector: Reflector,
  ) {
    super();
  }

  // A valid token is not enough: suspended and banned accounts are refused with a
  // 403 that names the reason, so the app can explain and sign out. A JUNIOR account
  // waiting for guardian consent is refused the same way (consent_pending) except on
  // routes marked @AllowPendingConsent.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) return false;
    const sub: string | undefined = context.switchToHttp().getRequest().user?.sub;
    if (sub) {
      await this.moderation.assertActive(sub);
      const allowPending = this.reflector.getAllAndOverride<boolean | undefined>(ALLOW_PENDING_CONSENT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowPending) await this.moderation.assertConsented(sub);
    }
    return true;
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // If passport gives an error or no user, always respond 401 (never 500)
    if (err || !user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
