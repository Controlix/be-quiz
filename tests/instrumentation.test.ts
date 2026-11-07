import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { register } from "@/instrumentation";
import * as calendarModule from "@/features/calendar";
import * as capabilitiesModule from "@/features/capabilities";
import * as prunerSubscriberModule from "@/lib/storagePrunerSubscriber";

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
    const prunerSpy = vi.spyOn(prunerSubscriberModule, "registerStoragePrunerSubscriber");

    await register();

    expect(registerSpy).not.toHaveBeenCalled();
    expect(prunerSpy).not.toHaveBeenCalled();
  });

  it("registers storage pruner subscriber and calendar subscriber when nodejs runtime", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    vi.spyOn(capabilitiesModule, "getCapabilities").mockReturnValue({
      vision: false,
      icalExport: false,
      whatsappShare: false,
      emailRegistration: false,
      sharedGoogleCalendar: true,
    });
    const calendarSpy = vi
      .spyOn(calendarModule, "registerSharedCalendarSubscriber")
      .mockReturnValue(() => {});
    const prunerSpy = vi
      .spyOn(prunerSubscriberModule, "registerStoragePrunerSubscriber")
      .mockReturnValue(() => {});

    await register();

    expect(prunerSpy).toHaveBeenCalledTimes(1);
    expect(calendarSpy).toHaveBeenCalledTimes(1);
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
