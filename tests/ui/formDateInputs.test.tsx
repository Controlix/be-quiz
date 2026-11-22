import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CapabilitiesProvider } from "@/features/capabilities";
import { QuizEntryForm } from "@/components/QuizEntryForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const baseCaps = {
  vision: false,
  icalExport: false,
  whatsappShare: false,
  emailRegistration: false,
  sharedGoogleCalendar: false,
};

describe("QuizEntryForm European Date and Time Inputs", () => {
  it.each([false, true])(
    "renders text inputs with European placeholders (DD/MM/JJJJ, 20:00) and no native date/time inputs (vision=%s)",
    (vision) => {
      const html = renderToStaticMarkup(
        <CapabilitiesProvider capabilities={{ ...baseCaps, vision }}>
          <QuizEntryForm currentMemberId="member-1" />
        </CapabilitiesProvider>
      );

      expect(html).not.toContain('type="date"');
      expect(html).not.toContain('type="time"');
      expect(html).toContain('placeholder="DD/MM/JJJJ"');
      expect(html).toContain('placeholder="20:00"');
    }
  );
});
