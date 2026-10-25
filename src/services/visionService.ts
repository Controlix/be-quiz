export interface VisionExtractionResult {
  isValid: boolean;
  missingFields: string[];
  data: {
    title?: string;
    date?: string;
    time?: string;
    location?: string;
    maxTeamSize?: number;
    organizerEmail?: string;
    registrationUrl?: string;
    entryFee?: string;
  };
  error?: string;
}

export function parseVisionExtractionResponse(rawInput: string): VisionExtractionResult {
  if (rawInput === "TIMEOUT") {
    return {
      isValid: false,
      missingFields: ["title", "date", "time", "location", "maxTeamSize"],
      data: {},
      error: "De flyer scan heeft een time-out opgelopen. Voer de gegevens manueel in.",
    };
  }

  try {
    let cleanInput = rawInput.trim();
    if (cleanInput.startsWith("```json")) {
      cleanInput = cleanInput.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    } else if (cleanInput.startsWith("```")) {
      cleanInput = cleanInput.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    cleanInput = cleanInput.trim();

    const parsed = JSON.parse(cleanInput);
    const missing: string[] = [];

    if (!parsed.title || typeof parsed.title !== "string" || !parsed.title.trim()) {
      missing.push("title");
    }
    if (!parsed.date || typeof parsed.date !== "string" || !parsed.date.trim()) {
      missing.push("date");
    }
    if (!parsed.time || typeof parsed.time !== "string" || !parsed.time.trim()) {
      missing.push("time");
    }
    if (!parsed.location || typeof parsed.location !== "string" || !parsed.location.trim()) {
      missing.push("location");
    }
    if (!parsed.maxTeamSize || typeof parsed.maxTeamSize !== "number" || parsed.maxTeamSize <= 0) {
      missing.push("maxTeamSize");
    }

    return {
      isValid: missing.length === 0,
      missingFields: missing,
      data: {
        title: parsed.title || undefined,
        date: parsed.date || undefined,
        time: parsed.time || undefined,
        location: parsed.location || undefined,
        maxTeamSize: parsed.maxTeamSize ? Number(parsed.maxTeamSize) : undefined,
        organizerEmail: parsed.organizerEmail || undefined,
        registrationUrl: parsed.registrationUrl || undefined,
        entryFee: parsed.entryFee || undefined,
      },
    };
  } catch (err: any) {
    return {
      isValid: false,
      missingFields: ["title", "date", "time", "location", "maxTeamSize"],
      data: {},
      error: "Kon de flyer tekst niet automatisch ontcijferen. Voer de velden manueel in.",
    };
  }
}

function detectImageMimeType(buffer: Buffer, fallback: string): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return fallback || "image/jpeg";
}

export async function extractQuizDetailsFromImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<VisionExtractionResult> {
  const effectiveMimeType = detectImageMimeType(imageBuffer, mimeType);
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const openAiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;

  // 1. Google Gemini Vision (Active & configured)
  if (geminiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const candidateModels = ["gemini-3.5-flash-lite", "gemini-2.5-flash"];
      let data: any = null;

      for (const model of candidateModels) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: "Extract pub quiz details from this flyer poster. If the year is omitted or past, assume 2026. Output strict JSON with keys: title (string), date (YYYY-MM-DD), time (HH:mm), location (string with venue and city), maxTeamSize (integer e.g. 4 or 5 or 6), organizerEmail (string or null), registrationUrl (string or null), entryFee (string e.g. '€20 / ploeg' or null).",
                    },
                    {
                      inline_data: {
                        mime_type: effectiveMimeType,
                        data: imageBuffer.toString("base64"),
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                response_mime_type: "application/json",
              },
            }),
          }
        );

        if (response.ok) {
          data = await response.json();
          break;
        } else if (response.status === 404) {
          // Model deprecated or not found for this account/project, try fallback model
          continue;
        } else {
          clearTimeout(timeoutId);
          return parseVisionExtractionResponse("TIMEOUT");
        }
      }

      clearTimeout(timeoutId);

      if (!data) {
        return parseVisionExtractionResponse("TIMEOUT");
      }

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return parseVisionExtractionResponse(content);
    } catch (err: any) {
      clearTimeout(timeoutId);
      return parseVisionExtractionResponse("TIMEOUT");
    }
  }

  // 2. OpenAI Vision (Fallback)
  if (openAiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Extract pub quiz details from this flyer poster. Output strict JSON with keys: title (string), date (YYYY-MM-DD), time (HH:mm), location (string), maxTeamSize (integer), organizerEmail (string or null), registrationUrl (string or null), entryFee (string or null).",
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${imageBuffer.toString("base64")}`,
                  },
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return parseVisionExtractionResponse("TIMEOUT");
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || "";
      return parseVisionExtractionResponse(content);
    } catch (err: any) {
      clearTimeout(timeoutId);
      return parseVisionExtractionResponse("TIMEOUT");
    }
  }

  // 3. Fallback when no API keys are present
  return {
    isValid: false,
    missingFields: ["title", "date", "time", "location", "maxTeamSize"],
    data: {},
    error: "Geen AI Vision API sleutel geconfigureerd in .env. Voer de gegevens manueel in.",
  };
}
