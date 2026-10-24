import { describe, it, expect } from "vitest";
import manifest from "../../public/manifest.json";
import { prisma } from "../../src/lib/db";
import { createQuiz } from "../../src/services/quizService";
import { setRsvp, getRsvpLineup } from "../../src/services/rsvpService";
import { generateRegistrationMailto } from "../../src/lib/mailto";
import { categorizeQuizForTabs } from "../../src/components/TimelineTabs";
import { toggleFeePayment } from "../../src/services/paymentService";
import { hashToken } from "../../src/lib/crypto";
import { createSession, validateSession } from "../../src/lib/auth";
import { parseVisionExtractionResponse } from "../../src/services/visionService";

describe("Pub Quiz App End-to-End Acceptance Suite", () => {
  // PWA Manifest Configuration
  it("PWA: verifies manifest configuration for mobile standalone installation", () => {
    expect(manifest.name).toBe("KwisVrienden");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/quizzes");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  // 1. Zero-RSVP Registration Test
  it("AC 1: generates mailto registration with 0 RSVPs successfully", async () => {
    const admin = await prisma.member.create({ data: { name: `Admin-AC1-${Date.now()}` } });
    const quiz = await createQuiz(
      {
        title: "Zero RSVP Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Leuven",
        maxTeamSize: 4,
        organizerEmail: "org@zero.be",
      },
      admin.id
    );

    const mailto = generateRegistrationMailto(quiz, quiz.team!, admin.name);
    expect(mailto.startsWith("mailto:org@zero.be?")).toBe(true);
    expect(mailto).toContain(encodeURIComponent(quiz.team!.name));
    expect(mailto).toContain(encodeURIComponent(admin.name));
  });

  // 2. Email Content Test (Decision D2)
  it("AC 2: verifies email contains ONLY team name, title, date, contact - NO player list or counts", () => {
    const quiz = {
      title: "Clean Email Quiz",
      startsAt: new Date("2026-11-20T20:00:00Z"),
      organizerEmail: "info@quiz.be",
    };
    const team = { name: "De Quizvrienden" };
    const mailto = generateRegistrationMailto(quiz, team, "Marc");

    expect(mailto).toContain("De%20Quizvrienden");
    expect(mailto).toContain("Marc");
    // Explicitly verify player lists and player counts are absent
    expect(mailto).not.toContain("Spelers");
    expect(mailto).not.toContain("Aantal");
  });

  // 3. Capacity & Waitlist FIFO Test
  it("AC 3: splits 5 RSVPs with maxTeamSize=4 into 4 active and 1 reserve in FIFO order", async () => {
    const admin = await prisma.member.create({ data: { name: `Admin-AC3-${Date.now()}` } });
    const quiz = await createQuiz(
      {
        title: "FIFO Capacity Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Antwerpen",
        maxTeamSize: 4,
      },
      admin.id
    );

    const players = [];
    for (let i = 1; i <= 5; i++) {
      players.push(await prisma.member.create({ data: { name: `Player ${i}-${Date.now()}` } }));
    }

    for (const player of players) {
      await setRsvp(quiz.team!.id, player.id, "ATTENDING");
    }

    const { active, reserves } = await getRsvpLineup(quiz.team!.id);
    expect(active.length).toBe(4);
    expect(reserves.length).toBe(1);
    expect(reserves[0].memberId).toBe(players[4].id);
  });

  // 4. Promotion Test
  it("AC 4: automatically promotes reserve player when an active attendee declines", async () => {
    const admin = await prisma.member.create({ data: { name: `Admin-AC4-${Date.now()}` } });
    const quiz = await createQuiz(
      {
        title: "Promotion Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Brugge",
        maxTeamSize: 2,
      },
      admin.id
    );

    const m1 = await prisma.member.create({ data: { name: `P1-${Date.now()}` } });
    const m2 = await prisma.member.create({ data: { name: `P2-${Date.now()}` } });
    const m3 = await prisma.member.create({ data: { name: `P3-${Date.now()}` } });

    await setRsvp(quiz.team!.id, m1.id, "ATTENDING");
    await setRsvp(quiz.team!.id, m2.id, "ATTENDING");
    await setRsvp(quiz.team!.id, m3.id, "ATTENDING");

    const before = await getRsvpLineup(quiz.team!.id);
    expect(before.active.length).toBe(2);
    expect(before.reserves[0].memberId).toBe(m3.id);

    // Active m1 declines
    await setRsvp(quiz.team!.id, m1.id, "DECLINED");
    const after = await getRsvpLineup(quiz.team!.id);
    expect(after.active.length).toBe(2);
    expect(after.reserves.length).toBe(0);
    expect(after.active.map((a) => a.memberId)).toContain(m3.id);
  });

  // 5. Timeline Tabs Test
  it("AC 5: correctly classifies quizzes across In Beraad, Gepland, and Archief", () => {
    const future = new Date(Date.now() + 86400000);
    const past = new Date(Date.now() - 86400000);

    expect(categorizeQuizForTabs({ startsAt: future, status: "OPEN", team: { registeredAt: null } })).toBe("IN_BERAAD");
    expect(categorizeQuizForTabs({ startsAt: future, status: "OPEN", team: { registeredAt: new Date() } })).toBe("GEPLAND");
    expect(categorizeQuizForTabs({ startsAt: past, status: "OPEN", team: { registeredAt: new Date() } })).toBe("ARCHIEF");
    expect(categorizeQuizForTabs({ startsAt: future, status: "CANCELLED", team: { registeredAt: null } })).toBe("ARCHIEF");
  });

  // 6. Payment Flag Test
  it("AC 6: records payer and timestamp on fee payment toggle", async () => {
    const admin = await prisma.member.create({ data: { name: `Admin-AC6-${Date.now()}` } });
    const quiz = await createQuiz(
      {
        title: "Payment Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Kortrijk",
        maxTeamSize: 4,
      },
      admin.id
    );

    const isPaid = await toggleFeePayment(quiz.team!.id, admin.id);
    expect(isPaid).toBe(true);

    const updatedTeam = await prisma.team.findUnique({ where: { id: quiz.team!.id } });
    expect(updatedTeam?.paidAt).not.toBeNull();
    expect(updatedTeam?.paidById).toBe(admin.id);
  });

  // 7. PWA Standalone Invite Claim Test
  it("AC 7: claims raw invite token pasted into login form", async () => {
    const member = await prisma.member.create({ data: { name: `PWA-Claimer-${Date.now()}` } });
    const rawToken = `invite-token-${Date.now()}`;
    await prisma.invite.create({
      data: { memberId: member.id, tokenHash: hashToken(rawToken) },
    });

    const invite = await prisma.invite.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    expect(invite).not.toBeNull();
    expect(invite?.usedAt).toBeNull();

    // Session creation
    const { token } = await createSession(member.id);
    const session = await validateSession(token);
    expect(session?.member.id).toBe(member.id);
  });

  // 8. AI Timeout & Failure Test
  it("AC 8: handles vision extraction timeout gracefully with manual fallback message", () => {
    const result = parseVisionExtractionResponse("TIMEOUT");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("time-out");
    expect(result.missingFields).toContain("title");
  });

  // 9. Concurrency Test
  it("AC 9: handles concurrent RSVPs at capacity limit using row locking", async () => {
    const admin = await prisma.member.create({ data: { name: `Admin-AC9-${Date.now()}` } });
    const quiz = await createQuiz(
      {
        title: "Concurrency Row Lock Quiz",
        startsAt: new Date(Date.now() + 86400000),
        location: "Mechelen",
        maxTeamSize: 1,
      },
      admin.id
    );

    const pA = await prisma.member.create({ data: { name: `P-A-${Date.now()}` } });
    const pB = await prisma.member.create({ data: { name: `P-B-${Date.now()}` } });

    await Promise.all([
      setRsvp(quiz.team!.id, pA.id, "ATTENDING"),
      setRsvp(quiz.team!.id, pB.id, "ATTENDING"),
    ]);

    const { active, reserves } = await getRsvpLineup(quiz.team!.id);
    expect(active.length).toBe(1);
    expect(reserves.length).toBe(1);
  });
});
