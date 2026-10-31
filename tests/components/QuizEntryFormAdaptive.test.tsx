import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CapabilitiesProvider } from "@/features/capabilities";
import { QuizEntryForm } from "@/components/QuizEntryForm";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("Adaptive Quiz Creation Form", () => {
  it("omits AI scanning tab and directly shows manual form when capabilities.vision is false", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider
        capabilities={{
          vision: false,
          icalExport: false,
          whatsappShare: false,
          emailRegistration: false,
        }}
      >
        <QuizEntryForm currentMemberId="member-123" />
      </CapabilitiesProvider>
    );

    // AI scanning tab should not be present
    expect(html).not.toContain("Flyer Scannen");
    expect(html).not.toContain("Flyer analyseren met AI");
    // Manual form fields should be immediately visible
    expect(html).toContain("Titel");
    expect(html).toContain("Datum");
    // Flyer upload capability is still available for visual reference
    expect(html).toContain("type=\"file\"");
  });

  it("renders AI scanning tab when capabilities.vision is true", () => {
    const html = renderToStaticMarkup(
      <CapabilitiesProvider
        capabilities={{
          vision: true,
          icalExport: false,
          whatsappShare: false,
          emailRegistration: false,
        }}
      >
        <QuizEntryForm currentMemberId="member-123" />
      </CapabilitiesProvider>
    );

    // AI scanning option tab should be present
    expect(html).toContain("Flyer Scannen");
  });
});
