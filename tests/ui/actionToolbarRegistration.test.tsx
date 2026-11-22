import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CapabilitiesProvider } from "@/features/capabilities";
import { ActionToolbar } from "@/components/ActionToolbar";

const baseCapabilities = {
  vision: false,
  icalExport: false,
  whatsappShare: false,
  emailRegistration: true,
  sharedGoogleCalendar: false,
};

const baseProps = {
  quizId: "quiz-1",
  quizTitle: "Voorjaarsquiz",
  quizDate: new Date("2026-12-10T20:00:00Z"),
  organizerEmail: "quiz@example.com",
  isPaid: false,
  teamName: "Onze Quizploeg",
  onRegisterToggle: vi.fn(),
  onPaymentToggle: vi.fn(),
};

describe("ActionToolbar - Decoupled Registration", () => {
  it("renders decoupled email confirmation control and open badge when unregistered with emailRegistration enabled", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={baseCapabilities}>
        <ActionToolbar {...baseProps} isRegistered={false} />
      </CapabilitiesProvider>
    );

    expect(html).toContain("Nog open");
    expect(html).toContain("Mail verzonden? Bevestig registratie");
    expect(html).not.toContain("Inschrijving heropenen / annuleren");
  });

  it("renders direct confirmation label without email prompt when emailRegistration is disabled", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={{ ...baseCapabilities, emailRegistration: false }}>
        <ActionToolbar {...baseProps} isRegistered={false} />
      </CapabilitiesProvider>
    );

    expect(html).toContain("Bevestig registratie");
    expect(html).not.toContain("Mail verzonden? Bevestig registratie");
  });

  it("renders registered badge and cancel/reopen button when isRegistered is true", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={baseCapabilities}>
        <ActionToolbar {...baseProps} isRegistered={true} />
      </CapabilitiesProvider>
    );

    expect(html).toContain("✓ Ingeschreven");
    expect(html).toContain("Inschrijving heropenen / annuleren");
    expect(html).not.toContain("Mail verzonden? Bevestig registratie");
  });
});
