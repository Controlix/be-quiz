import { describe, it, expect } from "vitest";
import { getCapabilities } from "@/features/capabilities/capabilities";

describe("Capability Registry", () => {
  it("defaults all capabilities to false when no flags are set (pure Core-only default)", () => {
    const caps = getCapabilities({});
    expect(caps.vision).toBe(false);
    expect(caps.icalExport).toBe(false);
    expect(caps.whatsappShare).toBe(false);
    expect(caps.emailRegistration).toBe(false);
  });

  it("does NOT auto-detect vision from API keys alone", () => {
    const caps = getCapabilities({ GEMINI_API_KEY: "test-key" });
    expect(caps.vision).toBe(false);
  });

  it("enables vision only when ENABLE_AI_VISION is 'true'", () => {
    const caps = getCapabilities({ ENABLE_AI_VISION: "true" });
    expect(caps.vision).toBe(true);
  });

  it("enables icalExport only when ENABLE_ICAL_EXPORT is 'true'", () => {
    const caps = getCapabilities({ ENABLE_ICAL_EXPORT: "true" });
    expect(caps.icalExport).toBe(true);
  });

  it("enables whatsappShare only when ENABLE_WHATSAPP_SHARE is 'true'", () => {
    const caps = getCapabilities({ ENABLE_WHATSAPP_SHARE: "true" });
    expect(caps.whatsappShare).toBe(true);
  });

  it("enables emailRegistration only when ENABLE_EMAIL_REGISTRATION is 'true'", () => {
    const caps = getCapabilities({ ENABLE_EMAIL_REGISTRATION: "true" });
    expect(caps.emailRegistration).toBe(true);
  });
});
