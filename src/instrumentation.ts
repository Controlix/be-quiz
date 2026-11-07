export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerStoragePrunerSubscriber } = await import("@/lib/storagePrunerSubscriber");
    registerStoragePrunerSubscriber();

    const { getCapabilities } = await import("@/features/capabilities");
    if (getCapabilities().sharedGoogleCalendar) {
      const { registerSharedCalendarSubscriber } = await import("@/features/calendar");
      registerSharedCalendarSubscriber();
    }
  }
}
