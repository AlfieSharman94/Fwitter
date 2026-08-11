import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type CurrentUser = { sub: string; email?: string };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
