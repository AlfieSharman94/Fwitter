import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // If passport gives an error or no user, always respond 401 (never 500)
    if (err || !user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
