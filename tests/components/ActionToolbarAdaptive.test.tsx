import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CapabilitiesProvider } from "@/features/capabilities";
import { ActionToolbar } from "@/components/ActionToolbar";

describe("Adaptive ActionToolbar", () => {
  const defaultProps = {
    quizId: "quiz-123",
    quizTitle: "Grote Quiz",
    quizDate: new Date("2026-11-15T20:00:00Z"),
    location: "Gent",
    durationMinutes: 180,
    organizerEmail: "organizer@example.com",
    isRegistered: false,
    isPaid: false,
    teamName: "De Kwissers",
    onRegisterToggle: vi.fn(),
    onPaymentToggle: vi.fn(),
  };

  it("always renders core Registration and Payment controls even when all auxiliary integrations are disabled", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider
        capabilities={{
          vision: false,
          icalExport: false,
          whatsappShare: false,
          emailRegistration: false,
        }}
      >
        <ActionToolbar {...defaultProps} />
      </CapabilitiesProvider>
    );

    // Core controls must be present
    expect(html).toContain("Ploeg Inschrijving");
    expect(html).toContain("Inschrijfgeld");
    expect(html).toContain("Bevestig registratie");

    // Auxiliary controls must NOT be present
    expect(html).not.toContain("In Agenda");
    expect(html).not.toContain("WhatsApp");
    expect(html).not.toContain("Schrijf Ploeg In (Open Mail)");
    expect(html).not.toContain("Kopieer mailtekst");
  });

  it("renders auxiliary integration buttons when their respective capabilities are enabled", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider
        capabilities={{
          vision: false,
          icalExport: true,
          whatsappShare: true,
          emailRegistration: true,
        }}
      >
        <ActionToolbar {...defaultProps} />
      </CapabilitiesProvider>
    );

    // All controls should be present
    expect(html).toContain("In Agenda");
    expect(html).toContain("WhatsApp");
    expect(html).toContain("Schrijf Ploeg In (Open Mail)");
    expect(html).toContain("Kopieer mailtekst");
    expect(html).toContain("Ploeg Inschrijving");
    expect(html).toContain("Inschrijfgeld");
  });
});
