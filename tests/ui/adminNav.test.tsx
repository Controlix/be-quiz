import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizzesDashboard } from "@/components/QuizzesDashboard";

describe("Admin Navigation Header", () => {
  it("renders Beheer link to /admin in QuizzesDashboard when isAdmin is true", () => {
    const html = renderToStaticMarkup(<QuizzesDashboard initialQuizzes={[]} isAdmin={true} />);

    expect(html).toContain('href="/admin"');
    expect(html).toContain("Beheer");
  });

  it("omits Beheer link to /admin in QuizzesDashboard when isAdmin is false or omitted", () => {
    const htmlExplicit = renderToStaticMarkup(
      <QuizzesDashboard initialQuizzes={[]} isAdmin={false} />
    );
    const htmlDefault = renderToStaticMarkup(<QuizzesDashboard initialQuizzes={[]} />);

    expect(htmlExplicit).not.toContain('href="/admin"');
    expect(htmlExplicit).not.toContain("Beheer");
    expect(htmlDefault).not.toContain('href="/admin"');
    expect(htmlDefault).not.toContain("Beheer");
  });
});
