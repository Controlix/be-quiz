import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizCard } from "../../src/components/QuizCard";

describe("QuizCard Rating Badge", () => {
  const dummyQuiz: any = {
    id: "q1",
    title: "Past Quiz Night",
    startsAt: new Date(Date.now() - 86400000),
    location: "Pub",
    status: "OPEN",
    team: { maxTeamSize: 4, registeredAt: new Date(), rsvps: [] },
  };

  it("renders amber rating badge when averageRating is present", () => {
    const html = renderToStaticMarkup(
      <QuizCard quiz={dummyQuiz} rating={{ average: 4.3, count: 3 }} />
    );
    expect(html).toContain("★ 4.3");
  });

  it("omits rating badge when rating is null or count is 0", () => {
    const html = renderToStaticMarkup(<QuizCard quiz={dummyQuiz} rating={null} />);
    expect(html).not.toContain("★");
  });

  it("omits rating badge when quiz is cancelled even if rating is present", () => {
    const cancelledQuiz: any = {
      ...dummyQuiz,
      status: "CANCELLED",
    };
    const html = renderToStaticMarkup(
      <QuizCard quiz={cancelledQuiz} rating={{ average: 4.3, count: 3 }} />
    );
    expect(html).not.toContain("★");
    expect(html).toContain("Geannuleerd");
  });
});
