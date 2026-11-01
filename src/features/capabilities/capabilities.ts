import { AppCapabilities } from "./types";

export function getCapabilities(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): AppCapabilities {
  const hasAiKey = Boolean(
    env.GEMINI_API_KEY ||
    env.OPENAI_API_KEY ||
    env.GOOGLE_GENERATIVE_AI_API_KEY ||
    env.AI_API_KEY
  );

  const hasGoogleCalendarCreds = Boolean(
    env.GOOGLE_CALENDAR_ID &&
    env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );

  return {
    vision: env.ENABLE_AI_VISION === "true" && hasAiKey,
    icalExport: env.ENABLE_ICAL_EXPORT === "true",
    whatsappShare: env.ENABLE_WHATSAPP_SHARE === "true",
    emailRegistration: env.ENABLE_EMAIL_REGISTRATION === "true",
    sharedGoogleCalendar: env.ENABLE_SHARED_GOOGLE_CALENDAR === "true" && hasGoogleCalendarCreds,
  };
}
