import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Seed TeamSetting singleton
  await prisma.teamSetting.upsert({
    where: { id: "singleton" },
    update: {
      defaultTeamName: "Ben in Black",
    },
    create: {
      id: "singleton",
      defaultTeamName: "Ben in Black",
    },
  });

  // Seed initial Admin member (Marc)
  const admin = await prisma.member.upsert({
    where: { id: "admin-seed-id" },
    update: {
      name: "Marc",
      role: "ADMIN",
    },
    create: {
      id: "admin-seed-id",
      name: "Marc",
      role: "ADMIN",
    },
  });

  // Seed Marc's dev invite token
  const crypto = await import("crypto");
  const adminHash = crypto.createHash("sha256").update("admin-marc-login").digest("hex");
  await prisma.invite.upsert({
    where: { memberId: admin.id },
    update: { tokenHash: adminHash, usedAt: null },
    create: {
      memberId: admin.id,
      tokenHash: adminHash,
      usedAt: null,
    },
  });

  console.log("Database seeded successfully with clean production state (Marc only, 0 quizzes).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
