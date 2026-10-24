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
  const memberNames = ["Sarah", "Tom", "Elena", "Thomas"];
  const memberMap = new Map<string, string>();
  memberMap.set("Marc", admin.id);

  for (const name of memberNames) {
    let m = await prisma.member.findFirst({ where: { name } });
    if (!m) {
      m = await prisma.member.create({
        data: {
          name,
          role: "USER",
        },
      });
    }
    memberMap.set(name, m.id);
  }

  // Seed Quizzes if none exist
  const existingQuizzes = await prisma.quiz.count();
  if (existingQuizzes === 0) {
    const q1 = await prisma.quiz.create({
      data: {
        title: "De Grote Herfstquiz",
        startsAt: new Date("2026-11-14T20:00:00Z"),
        location: "Zaal Centrum, Gent",
        entryFee: "€20 / ploeg",
        organizerEmail: "organisatie@quiz.be",
        createdById: admin.id,
        team: {
          create: {
            name: "De Quizvrienden",
            maxTeamSize: 4,
            registeredAt: new Date("2026-11-01T12:00:00Z"),
            registeredById: admin.id,
            paidAt: new Date("2026-11-01T12:00:00Z"),
            paidById: admin.id,
          },
        },
      },
      include: { team: true },
    });

    // Add RSVPs for Q1
    const q1Attendees = ["Marc", "Sarah", "Tom", "Elena", "Thomas"];
    for (let i = 0; i < q1Attendees.length; i++) {
      const name = q1Attendees[i];
      await prisma.rsvp.create({
        data: {
          teamId: q1.team!.id,
          memberId: memberMap.get(name)!,
          status: "ATTENDING",
          queuedSince: new Date(1000000 + i * 1000),
        },
      });
    }

    const q2 = await prisma.quiz.create({
      data: {
        title: "Scouts & Gidsen Kwis",
        startsAt: new Date("2026-11-28T19:30:00Z"),
        location: "Parochiehuis, Aalst",
        entryFee: "€25 / ploeg",
        organizerEmail: "scouts@aalst.be",
        createdById: admin.id,
        team: {
          create: {
            name: "De Quizvrienden",
            maxTeamSize: 4,
          },
        },
      },
      include: { team: true },
    });

    const q2Attendees = ["Marc", "Sarah", "Tom"];
    for (let i = 0; i < q2Attendees.length; i++) {
      const name = q2Attendees[i];
      await prisma.rsvp.create({
        data: {
          teamId: q2.team!.id,
          memberId: memberMap.get(name)!,
          status: "ATTENDING",
          queuedSince: new Date(2000000 + i * 1000),
        },
      });
    }
  }

  console.log("Database seeded successfully with quizzes & RSVPs.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
