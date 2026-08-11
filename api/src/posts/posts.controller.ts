import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly prisma: PrismaService) {}

  private parseLimit(limit?: string) {
    const n = Number(limit ?? 20);
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 20;
  }

  @Post()
  async create(@CurrentUser() user: { sub: string }, @Body() dto: CreatePostDto) {
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true },
    });
    if (!dbUser) throw new BadRequestException('profile_not_found');

    const content = dto.content.trim();
    if (!content) throw new BadRequestException('content_required');

    if (dto.parentPostId) {
      const parent = await this.prisma.posts.findUnique({
        where: { id: dto.parentPostId },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('parent_post_not_found');
    }

    const teamIds = Array.from(new Set(dto.teamIds ?? []));
    const topicIds = Array.from(new Set(dto.topicIds ?? []));

    // Top-level posts must be scoped to football content: at least one team or topic.
    // Replies inherit scope from their parent thread, so they are exempt.
    if (!dto.parentPostId && teamIds.length === 0 && topicIds.length === 0) {
      throw new BadRequestException('team_or_topic_required');
    }

    // Validate referenced ids exist (only if provided)
    if (teamIds.length) {
      const found = await this.prisma.teams.count({ where: { id: { in: teamIds } } });
      if (found !== teamIds.length) throw new BadRequestException('one_or_more_teams_not_found');
    }
    if (topicIds.length) {
      const found = await this.prisma.topics.count({ where: { id: { in: topicIds } } });
      if (found !== topicIds.length) throw new BadRequestException('one_or_more_topics_not_found');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const post = await tx.posts.create({
        data: {
          author_id: dbUser.id,
          content,
          parent_post_id: dto.parentPostId ?? null,
        },
        select: { id: true, created_at: true },
      });

      if (teamIds.length) {
        await tx.post_teams.createMany({
          data: teamIds.map((teamId) => ({ post_id: post.id, team_id: teamId })),
        });
      }

      if (topicIds.length) {
        await tx.post_topics.createMany({
          data: topicIds.map((topicId) => ({ post_id: post.id, topic_id: topicId })),
        });
      }

      return post;
    });

    return { ok: true, post: created };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const post = await this.prisma.posts.findUnique({
      where: { id },
      select: {
        id: true,
        content: true,
        created_at: true,
        parent_post_id: true,
        users: { select: { username: true, display_name: true, profile_image_url: true } },
        post_teams: { select: { teams: { select: { id: true, name: true } } } },
        post_topics: { select: { topics: { select: { id: true, name: true } } } },
      },
    });

    if (!post) throw new BadRequestException('post_not_found');
    return { post };
  }

  @Get(':id/replies')
  async replies(@Param('id') id: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const take = this.parseLimit(limit);
    const createdBefore = cursor ? new Date(cursor) : undefined;

    const replies = await this.prisma.posts.findMany({
      where: {
        parent_post_id: id,
        ...(createdBefore ? { created_at: { lt: createdBefore } } : {}),
      },
      orderBy: { created_at: 'desc' },
      take,
      select: {
        id: true,
        content: true,
        created_at: true,
        users: { select: { username: true, display_name: true, profile_image_url: true } },
      },
    });

    const nextCursor = replies.length ? replies[replies.length - 1].created_at.toISOString() : null;
    return { replies, nextCursor };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true },
    });
    if (!dbUser) throw new BadRequestException('profile_not_found');

    const post = await this.prisma.posts.findUnique({
      where: { id },
      select: { author_id: true },
    });
    if (!post) throw new NotFoundException('post_not_found');
    if (post.author_id !== dbUser.id) throw new ForbiddenException('not_your_post');

    // Hard delete — post_teams/post_topics and any replies cascade via FK onDelete.
    await this.prisma.posts.delete({ where: { id } });
    return { ok: true };
  }
}
