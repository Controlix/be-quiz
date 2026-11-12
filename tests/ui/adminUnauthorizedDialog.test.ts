import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminUnauthorizedDialog } from "@/components/AdminUnauthorizedDialog";

describe("AdminUnauthorizedDialog Component", () => {
  it("renders the warning AlertDialog with appropriate messaging and action label", () => {
    const html = renderToStaticMarkup(React.createElement(AdminUnauthorizedDialog));

    expect(html).toContain("Toegang Gewijzigd");
    expect(html).toContain(
      "Je hebt geen beheerdersrechten meer om deze pagina te bekijken. Je rechten zijn gewijzigd door een andere beheerder."
    );
    expect(html).toContain("Naar Quizzen");
    expect(html).toContain("bg-amber");
  });
});
