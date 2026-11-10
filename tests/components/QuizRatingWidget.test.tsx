import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizRatingWidget } from "../../src/components/QuizRatingWidget";

describe("QuizRatingWidget Static Markup", () => {
  it("renders null if quiz is not concluded or cancelled", () => {
    const html1 = renderToStaticMarkup(
      <QuizRatingWidget
        quizId="q1"
        isConcluded={false}
        isEligible={true}
        isCancelled={false}
        summary={{ average: null, count: 0, totalEligible: 4, userScore: null }}
      />
    );
    expect(html1).toBe("");

    const html2 = renderToStaticMarkup(
      <QuizRatingWidget
        quizId="q1"
        isConcluded={true}
        isEligible={true}
        isCancelled={true}
        summary={{ average: 4, count: 1, totalEligible: 4, userScore: 4 }}
      />
    );
    expect(html2).toBe("");
  });

  it("renders 5 interactive star buttons and prompt for active eligible players", () => {
    const html = renderToStaticMarkup(
      <QuizRatingWidget
        quizId="q1"
        isConcluded={true}
        isEligible={true}
        isCancelled={false}
        summary={{ average: 4.5, count: 2, totalEligible: 4, userScore: 4 }}
      />
    );
    expect(html).toContain("Hoe was deze quiz?");
    expect(html).toContain("Jouw stem is anoniem en priv");
    expect(html).toContain("Jouw stem: 4/5");
    expect(html).toContain("Teamscore: ★ 4.5 / 5 (2 van 4 spelers gestemd)");
  });

  it("renders star buttons with role radio and aria-checked attributes", () => {
    const html = renderToStaticMarkup(
      <QuizRatingWidget
        quizId="q1"
        isConcluded={true}
        isEligible={true}
        isCancelled={false}
        summary={{ average: 4.5, count: 2, totalEligible: 4, userScore: 4 }}
      />
    );
    expect(html).toContain('role="radio"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-checked="false"');
  });

  it("renders read-only aggregate summary for non-attending / reserve players", () => {
    const html = renderToStaticMarkup(
      <QuizRatingWidget
        quizId="q1"
        isConcluded={true}
        isEligible={false}
        isCancelled={false}
        summary={{ average: 4.3, count: 3, totalEligible: 4, userScore: null }}
      />
    );
    expect(html).toContain("Teambeoordeling");
    expect(html).toContain("4.3");
    expect(html).toContain("3 van 4 spelers");
    expect(html).not.toContain("Hoe was deze quiz?");
  });
});
