import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ModerationService } from '../moderation/moderation.service';
import { ROLES_KEY } from './roles.decorator';

// Runs after JwtAuthGuard (so req.user is set). Routes without @Roles pass.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly moderation: ModerationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const sub: string | undefined = context.switchToHttp().getRequest().user?.sub;
    if (!sub) throw new ForbiddenException('insufficient_role');

    const status = await this.moderation.accountStatus(sub);
    if (!required.includes(status.role)) throw new ForbiddenException('insufficient_role');
    return true;
  }
}
