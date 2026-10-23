import { Prisma } from '@prisma/client';
import { publicMediaUrl } from '../media/media-url';

// The one post shape every post-returning endpoint uses (feeds, profile posts,
// post detail, replies, create, bookmarks). Add new per-post fields here so they
// show up everywhere at once.
//
// It depends on who is looking: `liked_by_me` / `bookmarked_by_me` /
// `reposted_by_me` come from relations filtered to the viewer, and the like and
// repost counts are only revealed to the post's author (product decision for
// the under-16 audience; everyone else gets null).
function basePostSelect(viewerId: string) {
  return {
    id: true,
    content: true,
    created_at: true,
    author_id: true,
    parent_post_id: true,
    quoted_post_id: true,
    hidden_at: true,
    like_count: true,
    reply_count: true,
    repost_count: true,
    users: { select: { username: true, display_name: true, profile_image_url: true } },
    post_teams: { select: { teams: { select: { id: true, name: true } } } },
    post_topics: { select: { topics: { select: { id: true, name: true } } } },
    post_mentions: { select: { users: { select: { id: true, username: true } } } },
    post_hashtags: { select: { hashtags: { select: { tag: true } } } },
    matches: { select: { id: true, home_name: true, away_name: true } },
    media: { orderBy: { position: 'asc' }, select: { id: true, key: true, width: true, height: true } },
    post_likes: { where: { user_id: viewerId }, select: { user_id: true } },
    bookmarks: { where: { user_id: viewerId }, select: { user_id: true } },
    // The viewer's own plain repost of this post, if any.
    reposts: { where: { author_id: viewerId }, select: { id: true } },
    polls: {
      select: {
        ends_at: true,
        poll_options: {
          orderBy: { position: 'asc' },
          select: { id: true, text: true, _count: { select: { poll_votes: true } } },
        },
        // The viewer's vote, if any.
        poll_votes: { where: { user_id: viewerId }, select: { option_id: true } },
        _count: { select: { poll_votes: true } },
      },
    },
  } satisfies Prisma.postsSelect;
}

type RawPoll = NonNullable<Prisma.postsGetPayload<{ select: ReturnType<typeof basePostSelect> }>['polls']>;

// Results stay hidden until the viewer has voted, the poll has ended, or the
// viewer is the author (so people vote on the question, not the crowd).
function toPoll(poll: RawPoll, isAuthor: boolean) {
  const my_option_id = poll.poll_votes[0]?.option_id ?? null;
  const ended = poll.ends_at.getTime() <= Date.now();
  const revealed = isAuthor || my_option_id !== null || ended;
  return {
    ends_at: poll.ends_at,
    my_option_id,
    total_votes: revealed ? poll._count.poll_votes : null,
    options: poll.poll_options.map((o) => ({
      id: o.id,
      text: o.text,
      votes: revealed ? o._count.poll_votes : null,
    })),
  };
}

// A post plus the post it quotes. One level only: a quote of a quote shows the
// inner quote's text without its own embed.
function quotingPostSelect(viewerId: string) {
  return {
    ...basePostSelect(viewerId),
    quoted_post: { select: basePostSelect(viewerId) },
  } satisfies Prisma.postsSelect;
}

// What endpoints return: the post, what it quotes, and for a plain repost row
// the original it reposts (which may itself quote something).
export function feedPostSelect(viewerId: string) {
  return {
    ...quotingPostSelect(viewerId),
    repost_of: { select: quotingPostSelect(viewerId) },
  } satisfies Prisma.postsSelect;
}

type RawBase = Prisma.postsGetPayload<{ select: ReturnType<typeof basePostSelect> }>;
type RawQuoting = Prisma.postsGetPayload<{ select: ReturnType<typeof quotingPostSelect> }>;
type RawFeed = Prisma.postsGetPayload<{ select: ReturnType<typeof feedPostSelect> }>;

function toBasePost(row: RawBase, viewerId: string) {
  const { post_likes, bookmarks, reposts, post_mentions, post_hashtags, polls, matches, media, like_count, repost_count, ...rest } =
    row;
  const isAuthor = row.author_id === viewerId;
  return {
    ...rest,
    // Resolved entities, so the client only links @names and #tags that exist.
    mentions: post_mentions.map((m) => m.users),
    hashtags: post_hashtags.map((h) => h.hashtags.tag),
    match: matches,
    media: media.map((m) => ({ id: m.id, url: publicMediaUrl(m.key), width: m.width, height: m.height })),
    poll: polls ? toPoll(polls, isAuthor) : null,
    // Counters live on the row (maintained with the writes); counts stay author-only.
    like_count: isAuthor ? like_count : null,
    liked_by_me: post_likes.length > 0,
    bookmarked_by_me: bookmarks.length > 0,
    repost_count: isAuthor ? repost_count : null,
    reposted_by_me: reposts.length > 0,
  };
}

function toQuotingPost(row: RawQuoting, viewerId: string) {
  const { quoted_post, ...base } = row;
  return {
    ...toBasePost(base, viewerId),
    quoted_post: quoted_post ? toBasePost(quoted_post, viewerId) : null,
  };
}

export function toFeedPost(row: RawFeed, viewerId: string) {
  const { repost_of, ...quoting } = row;
  return {
    ...toQuotingPost(quoting, viewerId),
    repost_of: repost_of ? toQuotingPost(repost_of, viewerId) : null,
  };
}

export type FeedPost = ReturnType<typeof toFeedPost>;
