import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchService } from './search.service';
import { UsersService } from '../users/users.service';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly usersService: UsersService,
  ) {}

  @Get('users')
  async searchUsers(
    @CurrentUser() viewer: { sub: string },
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const viewerId = await this.usersService.getUserIdFromCognitoSub(viewer.sub);
    const limitNum = limit ? Number(limit) : 20;
    const users = await this.searchService.searchUsers(viewerId, q ?? '', limitNum);
    return { users };
  }
}
