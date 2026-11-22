import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizzesDashboard } from "@/components/QuizzesDashboard";

describe("Empty Dashboard State", () => {
  it("renders the empty state CTA linking to /quizzes/new when initialQuizzes is empty", () => {
    const html = renderToStaticMarkup(<QuizzesDashboard initialQuizzes={[]} />);

    expect(html).toContain("Nog geen quizzen gepland");
    expect(html).toContain("Eerste Quiz Toevoegen");
    expect(html).toContain('href="/quizzes/new"');
  });

  it("omits the empty state CTA when initialQuizzes contains a quiz", () => {
    const html = renderToStaticMarkup(
      <QuizzesDashboard
        initialQuizzes={[
          {
            id: "quiz-1",
            title: "Herfstquiz",
            startsAt: new Date(Date.now() + 86_400_000),
            location: "Gent",
            status: "OPEN",
            team: {
              name: "Onze Quizploeg",
              maxTeamSize: 4,
              registeredAt: null,
              paidAt: null,
              rsvps: [],
            },
          },
        ]}
      />
    );

    expect(html).not.toContain("Nog geen quizzen gepland");
    expect(html).not.toContain("Eerste Quiz Toevoegen");
    expect(html).toContain("Herfstquiz");
  });
});
