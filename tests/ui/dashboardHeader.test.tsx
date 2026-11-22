import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizzesDashboard } from "@/components/QuizzesDashboard";
import { CapabilitiesProvider } from "@/features/capabilities";
import { ActionToolbar } from "@/components/ActionToolbar";

const disabledCapabilities = {
  vision: false,
  icalExport: false,
  whatsappShare: false,
  emailRegistration: false,
  sharedGoogleCalendar: false,
};

describe("Dashboard Header & Currency Symbols", () => {
  it("renders a logout link to /auth/logout in QuizzesDashboard", () => {
    const html = renderToStaticMarkup(<QuizzesDashboard initialQuizzes={[]} />);

    expect(html).toContain('href="/auth/logout"');
  });

  it("renders Euro glyph (€) and no Dollar sign ($) in ActionToolbar", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={disabledCapabilities}>
        <ActionToolbar
          quizTitle="De Grote Kwis"
          quizDate={new Date("2026-12-01T20:00:00Z")}
          isRegistered={false}
          isPaid={false}
          teamName="Onze Quizploeg"
          onRegisterToggle={vi.fn()}
          onPaymentToggle={vi.fn()}
        />
      </CapabilitiesProvider>
    );

    expect(html).toContain("€");
    expect(html).not.toContain("$");
  });
});
