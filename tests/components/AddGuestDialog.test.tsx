import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AddGuestDialog } from "../../src/components/AddGuestDialog";

describe("AddGuestDialog Component", () => {
  it("renders when isOpen is true", () => {
    const html = renderToStaticMarkup(
      <AddGuestDialog isOpen={true} onClose={vi.fn()} onAddGuest={vi.fn()} />
    );

    expect(html).toContain("Gastspeler toevoegen");
    expect(html).toContain("Naam van gastspeler");
    expect(html).toContain("Toevoegen");
  });

  it("returns null when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <AddGuestDialog isOpen={false} onClose={vi.fn()} onAddGuest={vi.fn()} />
    );

    expect(html).toBe("");
  });
});
