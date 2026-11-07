import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizzesDashboard } from "@/components/QuizzesDashboard";

describe("QuizzesDashboard Header Branding", () => {
  it("renders custom teamName in header when provided", () => {
    const html = renderToStaticMarkup(
      <QuizzesDashboard initialQuizzes={[]} teamName="Onze Quizploeg" />
    );
    expect(html).toContain("Onze Quizploeg");
    expect(html).not.toContain("KwisVrienden");
    expect(html).toContain("Jullie kwisagenda");
  });

  it("falls back to 'KwisVrienden' when teamName is undefined", () => {
    const html = renderToStaticMarkup(<QuizzesDashboard initialQuizzes={[]} />);
    expect(html).toContain("KwisVrienden");
  });

  it("falls back to 'KwisVrienden' when teamName is empty or whitespace", () => {
    const html = renderToStaticMarkup(<QuizzesDashboard initialQuizzes={[]} teamName="   " />);
    expect(html).toContain("KwisVrienden");
  });
});
