import "dotenv/config";
import { PrismaClient } from "@prisma/client";

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

async function upsertTeam(name) {
  const existing = await prisma.teams.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return;

  // Create with only the columns we know exist from your schema conventions.
  // If your teams table has extra NOT NULL columns, we'll handle that next.
  await prisma.teams.create({
    data: {
      name,
      logo_url: null,
      city: null,
      country: null,
      league: null, // if this column doesn't exist Prisma will error; we'll adjust instantly
    },
  });
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

async function main() {
  for (const t of teams) await upsertTeam(t.name);
  for (const tp of topics) await upsertTopic(tp);

  console.log({
    teams: await prisma.teams.count(),
    topics: await prisma.topics.count(),
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
