import { AppCapabilities } from "./types";

export function getCapabilities(env: NodeJS.ProcessEnv = process.env): AppCapabilities {
  return {
    vision: env.ENABLE_AI_VISION === "true",
    icalExport: env.ENABLE_ICAL_EXPORT === "true",
    whatsappShare: env.ENABLE_WHATSAPP_SHARE === "true",
    emailRegistration: env.ENABLE_EMAIL_REGISTRATION === "true",
  };
}
