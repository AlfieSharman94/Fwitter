import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { leagues, extraTopics } from "./seed-data/teams.mjs";

const prisma = new PrismaClient();

const teams = [
  // Premier League-ish
  { name: "Arsenal" },
  { name: "Chelsea" },
  { name: "Liverpool" },
  { name: "Manchester City" },
  { name: "Manchester United" },
  { name: "Tottenham Hotspur" },

  // La Liga-ish
  { name: "Real Madrid" },
  { name: "FC Barcelona" },
  { name: "Atlético de Madrid" },

  // Serie A-ish
  { name: "Juventus" },
  { name: "Inter" },
  { name: "AC Milan" },
  { name: "Napoli" },

  // Bundesliga-ish
  { name: "Bayern Munich" },
  { name: "Borussia Dortmund" },
];

const topics = [
  { name: "Premier League", description: "English top flight" },
  { name: "La Liga", description: "Spanish top flight" },
  { name: "Serie A", description: "Italian top flight" },
  { name: "Bundesliga", description: "German top flight" },
  { name: "UEFA Champions League", description: "Champions League nights" },
  { name: "Transfers", description: "Deals, rumours, deadline day" },
  { name: "Matchday", description: "Live reactions and post-match takes" },
  { name: "VAR", description: "Refereeing decisions and controversy" },
  { name: "Injuries", description: "Fitness updates and return timelines" },
  { name: "Tactics", description: "Systems, analysis, coaching" },
];

// Creates a club or refreshes its league/country label (promotion and relegation
// move the label, never remove the club). Logos are filled by the fixtures sync.
async function upsertTeam({ name, league, country }) {
  const existing = await prisma.teams.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, league: true, country: true },
  });
  if (existing) {
    if (existing.league !== league || existing.country !== country) {
      await prisma.teams.update({ where: { id: existing.id }, data: { league, country } });
    }
    return;
  }
  await prisma.teams.create({ data: { name, league, country, logo_url: null, city: null } });
}

async function upsertTopic(tp) {
  const existing = await prisma.topics.findFirst({
    where: { name: { equals: tp.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    await prisma.topics.update({
      where: { id: existing.id },
      data: { description: tp.description },
    });
    return;
  }

  await prisma.topics.create({
    data: {
      name: tp.name,
      description: tp.description,
      icon: null,
    },
  });
}

// Starter list for the submit-time word filter (matched on word boundaries, case-
// insensitive). Moderators extend it from the dashboard; this only ever adds.
const bannedWords = [
  "fuck", "fucking", "fucked", "shit", "cunt", "bitch", "wanker", "twat", "dickhead", "prick", "bastard",
];

// Initial admins: comma-separated emails in ADMIN_EMAILS. Promotion only; the seed
// never demotes, so later role changes made from the dashboard stick.
async function promoteAdmins() {
  const emails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  let promoted = 0;
  for (const email of emails) {
    const { count } = await prisma.users.updateMany({
      where: { email: { equals: email, mode: "insensitive" }, role: { not: "ADMIN" } },
      data: { role: "ADMIN" },
    });
    promoted += count;
  }
  return { configured: emails.length, promoted };
}

async function main() {
  // The original 15 stay in the file for reference; the league lists are the source of truth.
  for (const { country, league, teams: names } of leagues) {
    for (const name of names) await upsertTeam({ name, league, country });
  }
  for (const tp of [...topics, ...extraTopics]) await upsertTopic(tp);
  await prisma.banned_words.createMany({
    data: bannedWords.map((word) => ({ word: word.toLowerCase() })),
    skipDuplicates: true,
  });
  const admins = await promoteAdmins();

  console.log({
    teams: await prisma.teams.count(),
    topics: await prisma.topics.count(),
    bannedWords: await prisma.banned_words.count(),
    admins,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
