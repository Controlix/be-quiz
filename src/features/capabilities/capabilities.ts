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

  return {
    vision: env.ENABLE_AI_VISION === "true" && hasAiKey,
    icalExport: env.ENABLE_ICAL_EXPORT === "true",
    whatsappShare: env.ENABLE_WHATSAPP_SHARE === "true",
    emailRegistration: env.ENABLE_EMAIL_REGISTRATION === "true",
  };
}
