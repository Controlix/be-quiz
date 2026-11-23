import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EditQuizDialog } from "../../src/components/EditQuizDialog";

describe("EditQuizDialog", () => {
  const sampleQuiz = {
    title: "Herfstkwis Gent",
    startsAt: new Date(2026, 10, 20, 20, 15),
    location: "Zaal Centrum, Gent",
    organizerEmail: "info@kwis.be",
    entryFee: "€5 / persoon",
  };

  it("renders nothing when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <EditQuizDialog isOpen={false} quiz={sampleQuiz} onClose={vi.fn()} onSave={vi.fn()} />
    );
    expect(html).toBe("");
  });

  it("renders pre-populated European date/time, metadata, and parsed fee unit when open", () => {
    const html = renderToStaticMarkup(
      <EditQuizDialog isOpen={true} quiz={sampleQuiz} onClose={vi.fn()} onSave={vi.fn()} />
    );

    expect(html).toContain("Quizgegevens bewerken");
    expect(html).toContain('value="Herfstkwis Gent"');
    expect(html).toContain('value="20/11/2026"');
    expect(html).toContain('value="20:15"');
    expect(html).toContain('value="Zaal Centrum, Gent"');
    expect(html).toContain('value="info@kwis.be"');
    expect(html).toContain('value="5"');
    expect(html).toMatch(/aria-pressed="false"[^>]*>\/ ploeg/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>\/ persoon/);
    expect(html).toContain("Annuleren");
    expect(html).toContain("Opslaan");
  });

  it("handles null optional fields and legacy freeform entryFee safely", () => {
    const html = renderToStaticMarkup(
      <EditQuizDialog
        isOpen={true}
        quiz={{
          title: "Gratis Kwis",
          startsAt: new Date(2026, 11, 5, 19, 30),
          location: "Kaffee De Hoek",
          organizerEmail: null,
          entryFee: "gratis",
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(html).toContain('value="Gratis Kwis"');
    expect(html).toContain('value="05/12/2026"');
    expect(html).toContain('value="19:30"');
    expect(html).toContain('value=""');
    expect(html).toMatch(/aria-pressed="true"[^>]*>\/ ploeg/);
  });
});
