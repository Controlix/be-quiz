import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { register } from "@/instrumentation";
import * as calendarModule from "@/features/calendar";
import * as capabilitiesModule from "@/features/capabilities";

describe("instrumentation.ts", () => {
  const originalRuntime = process.env.NEXT_RUNTIME;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.NEXT_RUNTIME = originalRuntime;
  });

  it("does nothing when NEXT_RUNTIME is not nodejs", async () => {
    process.env.NEXT_RUNTIME = "edge";
    const registerSpy = vi.spyOn(calendarModule, "registerSharedCalendarSubscriber");

    await register();

    expect(registerSpy).not.toHaveBeenCalled();
  });

  it("registers subscriber when nodejs runtime and capability is true", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    vi.spyOn(capabilitiesModule, "getCapabilities").mockReturnValue({
      vision: false,
      icalExport: false,
      whatsappShare: false,
      emailRegistration: false,
      sharedGoogleCalendar: true,
    });
    const registerSpy = vi.spyOn(calendarModule, "registerSharedCalendarSubscriber").mockReturnValue(() => {});

    await register();

    expect(registerSpy).toHaveBeenCalledTimes(1);
  });

  it("does not register subscriber when capability is false", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    vi.spyOn(capabilitiesModule, "getCapabilities").mockReturnValue({
      vision: false,
      icalExport: false,
      whatsappShare: false,
      emailRegistration: false,
      sharedGoogleCalendar: false,
    });
    const registerSpy = vi.spyOn(calendarModule, "registerSharedCalendarSubscriber");

    await register();

    expect(registerSpy).not.toHaveBeenCalled();
  });
});
