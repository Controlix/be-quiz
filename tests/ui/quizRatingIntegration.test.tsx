import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizDetailClient } from "../../src/components/QuizDetailClient";
import { QuizzesDashboard } from "../../src/components/QuizzesDashboard";

describe("Quiz Rating Page Integration", () => {
  it("renders QuizRatingWidget in QuizDetailClient for concluded quizzes", () => {
    const pastQuiz: any = {
      id: "q-past",
      title: "Concluded Quiz",
      startsAt: new Date(Date.now() - 86400000),
      durationMinutes: 180,
      location: "Pub",
      status: "OPEN",
      team: {
        id: "t-past",
        maxTeamSize: 4,
        registeredAt: null,
        paidAt: null,
        rsvps: [
          {
            memberId: "m1",
            status: "ATTENDING",
            queuedSince: new Date(1000),
            member: { id: "m1", name: "Player" },
          },
        ],
      },
    };

    const ratingSummary = { average: 5, count: 1, totalEligible: 1, userScore: 5 };

    const html = renderToStaticMarkup(
      <QuizDetailClient quiz={pastQuiz} currentMemberId="m1" initialRatingSummary={ratingSummary} />
    );

    expect(html).toContain("Hoe was deze quiz?");
  });

  it("renders rating badges in QuizzesDashboard for quizzes with ratings", () => {
    const quizzes: any[] = [
      {
        id: "q-archived",
        title: "Archived Quiz",
        startsAt: new Date(Date.now() - 86400000),
        status: "OPEN",
        team: { maxTeamSize: 4, registeredAt: null, rsvps: [] },
      },
    ];
    // Realistic average for 2 players (e.g. 4 and 5): (4 + 5) / 2 = 4.5
    const ratingsMap = { "q-archived": { average: 4.5, count: 2 } };

    const html = renderToStaticMarkup(
      <QuizzesDashboard initialQuizzes={quizzes} ratingsMap={ratingsMap} initialTab="ARCHIEF" />
    );

    expect(html).toContain("★ 4.5");
  });
});
