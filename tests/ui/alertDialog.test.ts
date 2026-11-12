import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AlertDialog } from "@/components/AlertDialog";

describe("AlertDialog Component", () => {
  it("renders null when isOpen is false", () => {
    const html = renderToStaticMarkup(
      React.createElement(AlertDialog, {
        isOpen: false,
        title: "Test Title",
        message: "Test Message",
        onClose: () => {},
      })
    );
    expect(html).toBe("");
  });

  it("renders title, message, and default action label when isOpen is true", () => {
    const html = renderToStaticMarkup(
      React.createElement(AlertDialog, {
        isOpen: true,
        title: "Toegang Gewijzigd",
        message: "Je beheerdersrechten zijn ingetrokken.",
        onClose: () => {},
      })
    );
    expect(html).toContain("Toegang Gewijzigd");
    expect(html).toContain("Je beheerdersrechten zijn ingetrokken.");
    expect(html).toContain("Sluiten");
  });

  it("renders custom action label and warning styling", () => {
    const html = renderToStaticMarkup(
      React.createElement(AlertDialog, {
        isOpen: true,
        title: "Toegang Gewijzigd",
        message: "Je beheerdersrechten zijn ingetrokken.",
        actionLabel: "Naar Quizzen",
        variant: "warning",
        onClose: () => {},
      })
    );
    expect(html).toContain("Naar Quizzen");
    expect(html).toContain("bg-amber");
  });

  it("renders error variant styling", () => {
    const html = renderToStaticMarkup(
      React.createElement(AlertDialog, {
        isOpen: true,
        title: "Fout",
        message: "Actie mislukt.",
        variant: "error",
        onClose: () => {},
      })
    );
    expect(html).toContain("bg-red");
  });
});
