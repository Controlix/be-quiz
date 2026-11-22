import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminFeedbackClient, FeedbackItem } from "@/components/AdminFeedbackClient";

const sampleFeedbacks: FeedbackItem[] = [
  {
    id: "fb-open-with-shot",
    category: "BUG",
    message: "Knop overlapt op mobiel",
    pageUrl: "/quizzes/1",
    userAgent: "Mozilla/5.0",
    screenshot: "/uploads/feedback-1.png",
    isResolved: false,
    resolvedAt: null,
    createdAt: new Date("2026-11-20T18:30:00Z"),
    member: { id: "m-1", name: "Marc" },
  },
  {
    id: "fb-open-no-shot",
    category: "IDEA",
    message: "Dark mode toevoegen",
    pageUrl: "/quizzes",
    screenshot: null,
    isResolved: false,
    resolvedAt: null,
    createdAt: new Date("2026-11-21T10:00:00Z"),
    member: { id: "m-2", name: "An" },
  },
  {
    id: "fb-resolved",
    category: "QUESTION",
    message: "Opgeloste vraag over puntentelling",
    pageUrl: "/admin",
    screenshot: "/uploads/feedback-resolved.png",
    isResolved: true,
    resolvedAt: new Date("2026-11-21T12:00:00Z"),
    createdAt: new Date("2026-11-19T09:00:00Z"),
    member: { id: "m-3", name: "Piet" },
  },
];

describe("AdminFeedbackClient Render & Filtering", () => {
  it("renders open items in the default OPEN tab, shows accurate tab counts, and omits resolved items from the initial list", () => {
    const html = renderToStaticMarkup(<AdminFeedbackClient initialFeedbacks={sampleFeedbacks} />);

    expect(html).toContain("Knop overlapt op mobiel");
    expect(html).toContain("Dark mode toevoegen");
    expect(html).not.toContain("Opgeloste vraag over puntentelling");

    expect(html).toContain("Openstaand");
    expect(html).toContain(">2<");
    expect(html).toContain("Opgelost");
    expect(html).toContain("(1)");
    expect(html).toContain("Alle (3)");
  });

  it("renders a clickable screenshot thumbnail only when an item has a screenshot and keeps lightbox closed initially", () => {
    const htmlWithShot = renderToStaticMarkup(
      <AdminFeedbackClient initialFeedbacks={[sampleFeedbacks[0]]} />
    );
    const htmlWithoutShot = renderToStaticMarkup(
      <AdminFeedbackClient initialFeedbacks={[sampleFeedbacks[1]]} />
    );

    expect(htmlWithShot).toContain('alt="Screenshot voor fb-open-with-shot"');
    expect(htmlWithShot).toContain('src="/uploads/feedback-1.png"');
    expect(htmlWithShot).not.toContain("Screenshot bekijken");
    expect(htmlWithoutShot).not.toContain("<img");
  });
});
