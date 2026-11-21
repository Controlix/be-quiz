import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollMemberDialog } from "../../src/components/EnrollMemberDialog";

describe("EnrollMemberDialog Component", () => {
  it("returns empty markup when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <EnrollMemberDialog
        isOpen={false}
        onClose={vi.fn()}
        availableMembers={[{ id: "m1", name: "Charlie" }]}
        onEnroll={vi.fn()}
      />
    );
    expect(html).toBe("");
  });

  it("renders eligible unresponded members as clickable button rows when open", () => {
    const html = renderToStaticMarkup(
      <EnrollMemberDialog
        isOpen={true}
        onClose={vi.fn()}
        availableMembers={[
          { id: "m1", name: "Charlie" },
          { id: "m2", name: "Dana" },
        ]}
        onEnroll={vi.fn()}
      />
    );

    expect(html).toContain("Teamlid toevoegen");
    expect(html).toContain("Charlie");
    expect(html).toContain("Dana");
    expect(html).toContain("<button");
    expect(html).toContain('aria-label="Sluiten"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it("renders empty state message when no unresponded members remain", () => {
    const html = renderToStaticMarkup(
      <EnrollMemberDialog
        isOpen={true}
        onClose={vi.fn()}
        availableMembers={[]}
        onEnroll={vi.fn()}
      />
    );

    expect(html).toContain("Alle teamleden hebben al gereageerd.");
    expect(html).toContain("Sluiten");
  });

  it("disables member rows when isSubmitting is true", () => {
    const html = renderToStaticMarkup(
      <EnrollMemberDialog
        isOpen={true}
        onClose={vi.fn()}
        availableMembers={[{ id: "m1", name: "Charlie" }]}
        onEnroll={vi.fn()}
        isSubmitting={true}
      />
    );

    expect(html).toContain("disabled");
  });
});
