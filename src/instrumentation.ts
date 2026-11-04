export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getCapabilities } = await import("@/features/capabilities");
    if (getCapabilities().sharedGoogleCalendar) {
      const { registerSharedCalendarSubscriber } = await import("@/features/calendar");
      registerSharedCalendarSubscriber();
    }
  }
}
