import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../src/lib/db";
import { addGuestRsvp, removeGuestRsvp, getRsvpLineup } from "../../src/services/rsvpService";
import { getQuizRatingSummary } from "../../src/services/ratingService";
import { formatLineupSummary } from "../../src/features/calendar/shared/formatter";

describe("Guest Players Domain Service (guestRsvpService)", () => {
  let memberAlice: { id: string; name: string };
  let memberBob: { id: string; name: string };
  let adminCharlie: { id: string; name: string };
  let quiz: { id: string };
  let team: { id: string };

  beforeEach(async () => {
    // Unique test members
    memberAlice = await prisma.member.create({
      data: { name: `Alice-${Date.now()}` },
    });
    memberBob = await prisma.member.create({
      data: { name: `Bob-${Date.now()}` },
    });
    adminCharlie = await prisma.member.create({
      data: { name: `AdminCharlie-${Date.now()}`, role: "ADMIN" },
    });

    quiz = await prisma.quiz.create({
      data: {
        title: "Guest Players Service Test Quiz",
        startsAt: new Date(Date.now() + 86400000), // tomorrow
        location: "Service Test Venue",
        createdById: adminCharlie.id,
      },
    });

    team = await prisma.team.create({
      data: {
        quizId: quiz.id,
        name: "Test Squad",
        maxTeamSize: 2, // Small cap to easily test waitlists
      },
    });
  });

  it("adds a guest with status ATTENDING and includes inviter details", async () => {
    const rsvp = await addGuestRsvp(team.id, "Sarah", memberAlice.id);

    expect(rsvp.id).toBeDefined();
    expect(rsvp.guestName).toBe("Sarah");
    expect(rsvp.memberId).toBeNull();
    expect(rsvp.invitedById).toBe(memberAlice.id);
    expect(rsvp.status).toBe("ATTENDING");
    expect(rsvp.invitedBy?.name).toBe(memberAlice.name);

    const lineup = await getRsvpLineup(team.id);
    expect(lineup.active.length).toBe(1);
    expect(lineup.active[0].guestName).toBe("Sarah");
  });

  it("throws validation error on blank/whitespace name or name > 50 chars", async () => {
    await expect(addGuestRsvp(team.id, "", memberAlice.id)).rejects.toThrow();
    await expect(addGuestRsvp(team.id, "   ", memberAlice.id)).rejects.toThrow();
    await expect(addGuestRsvp(team.id, "a".repeat(51), memberAlice.id)).rejects.toThrow();
  });

  it("throws validation error if same inviter adds duplicate case-insensitive guest name", async () => {
    await addGuestRsvp(team.id, "Sarah", memberAlice.id);

    await expect(addGuestRsvp(team.id, "sarah", memberAlice.id)).rejects.toThrow(/al toegevoegd/i);

    // Another member CAN invite a guest with the same name
    const bobGuest = await addGuestRsvp(team.id, "Sarah", memberBob.id);
    expect(bobGuest.id).toBeDefined();
  });

  it("allows the inviter to remove their guest and hard-deletes the RSVP", async () => {
    const guest = await addGuestRsvp(team.id, "Sarah", memberAlice.id);

    await removeGuestRsvp(guest.id, memberAlice.id, "USER");

    const found = await prisma.rsvp.findUnique({ where: { id: guest.id } });
    expect(found).toBeNull();

    const lineup = await getRsvpLineup(team.id);
    expect(lineup.active.length).toBe(0);
  });

  it("allows an admin to remove any guest", async () => {
    const guest = await addGuestRsvp(team.id, "Sarah", memberAlice.id);

    await removeGuestRsvp(guest.id, adminCharlie.id, "ADMIN");

    const found = await prisma.rsvp.findUnique({ where: { id: guest.id } });
    expect(found).toBeNull();
  });

  it("rejects unauthorized removal by another non-admin teammate", async () => {
    const guest = await addGuestRsvp(team.id, "Sarah", memberAlice.id);

    await expect(removeGuestRsvp(guest.id, memberBob.id, "USER")).rejects.toThrow(
      /geen toegang|forbidden/i
    );
  });

  it("promotes the next reserve when an active guest is removed", async () => {
    // maxTeamSize is 2
    // Spot 1: Member Alice (queued at 1000)
    await prisma.rsvp.create({
      data: {
        teamId: team.id,
        memberId: memberAlice.id,
        status: "ATTENDING",
        queuedSince: new Date(1000),
      },
    });

    // Spot 2: Guest Sarah (invited by Alice, queued at now)
    const guestSarah = await addGuestRsvp(team.id, "Sarah", memberAlice.id);

    // Reserve 1: Member Bob (queued 5 seconds later)
    await prisma.rsvp.create({
      data: {
        teamId: team.id,
        memberId: memberBob.id,
        status: "ATTENDING",
        queuedSince: new Date(Date.now() + 5000),
      },
    });

    let lineup = await getRsvpLineup(team.id);
    expect(lineup.active.length).toBe(2);
    expect(lineup.active[0].memberId).toBe(memberAlice.id);
    expect(lineup.active[1].id).toBe(guestSarah.id);
    expect(lineup.reserves.length).toBe(1);
    expect(lineup.reserves[0].memberId).toBe(memberBob.id);

    // Remove active guest Sarah
    await removeGuestRsvp(guestSarah.id, memberAlice.id, "USER");

    lineup = await getRsvpLineup(team.id);
    expect(lineup.active.length).toBe(2);
    expect(lineup.active[0].memberId).toBe(memberAlice.id);
    expect(lineup.active[1].memberId).toBe(memberBob.id);
    expect(lineup.reserves.length).toBe(0);
  });

  it("ignores active guest players when calculating totalEligible for rating summary", async () => {
    // Conclude the quiz so rating applies
    const concludedQuiz = await prisma.quiz.create({
      data: {
        title: "Concluded Quiz for Ratings",
        startsAt: new Date(Date.now() - 7200000), // 2 hours ago
        durationMinutes: 60,
        location: "Test Venue",
        createdById: adminCharlie.id,
      },
    });

    const ratingTeam = await prisma.team.create({
      data: {
        quizId: concludedQuiz.id,
        name: "Rating Team",
        maxTeamSize: 4,
      },
    });

    // Add 1 member and 1 guest
    await prisma.rsvp.create({
      data: {
        teamId: ratingTeam.id,
        memberId: memberAlice.id,
        status: "ATTENDING",
        queuedSince: new Date(),
      },
    });

    await addGuestRsvp(ratingTeam.id, "Sarah", memberAlice.id);

    const summary = await getQuizRatingSummary(concludedQuiz.id);
    // Only registered memberAlice is eligible to rate, not the guest
    expect(summary.totalEligible).toBe(1);
  });

  it("calendar formatter handles lineup safely when guests attend", () => {
    const attendees = [
      {
        member: { name: "Alice" },
        guestName: null,
        invitedBy: null,
      },
      {
        member: null,
        guestName: "Sarah",
        invitedBy: { name: "Alice" },
      },
    ];

    const formatted = formatLineupSummary(attendees as any);
    expect(formatted).toContain("Alice");
    expect(formatted).toContain("Sarah (Gast van Alice)");
  });
});
