import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Seed TeamSetting singleton
  await prisma.teamSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      defaultTeamName: "De Quizvrienden",
    },
  });

  // Seed initial Admin member
  const admin = await prisma.member.upsert({
    where: { id: "admin-seed-id" },
    update: {},
    create: {
      id: "admin-seed-id",
      name: "Marc",
      role: "ADMIN",
    },
  });

  // Seed additional friends
  const members = ["Sarah", "Tom", "Elena", "Thomas"];
  for (const name of members) {
    await prisma.member.create({
      data: {
        name,
        role: "USER",
      },
    });
  }

  console.log("Database seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
