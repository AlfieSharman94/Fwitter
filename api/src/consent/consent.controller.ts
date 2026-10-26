import { Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConsentService } from './consent.service';
import { messagePage, reviewPage } from './consent-pages';

// Public: the guardian opens these from the email, with no account of their own. The token in
// the path is the only credential. GET only shows the page; the two POSTs act.
@Controller('consent')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class ConsentController {
  constructor(private readonly consent: ConsentService) {}

  @Get(':token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async review(@Param('token') token: string) {
    const found = await this.consent.lookup(token);
    if (found.state !== 'valid') return messagePage(found.state);
    return reviewPage({ username: found.username, token });
  }

  @Post(':token/confirm')
  @HttpCode(200)
  @Header('Content-Type', 'text/html; charset=utf-8')
  async confirm(@Param('token') token: string) {
    return messagePage(await this.consent.confirm(token));
  }

  @Post(':token/decline')
  @HttpCode(200)
  @Header('Content-Type', 'text/html; charset=utf-8')
  async decline(@Param('token') token: string) {
    return messagePage(await this.consent.decline(token));
  }
}
