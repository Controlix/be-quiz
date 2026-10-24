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
    const parsed = JSON.parse(rawInput);
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

export async function extractQuizDetailsFromImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<VisionExtractionResult> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    // Graceful offline mock response for local testing without external key
    return {
      isValid: true,
      missingFields: [],
      data: {
        title: "Gedetecteerde Quiz",
        date: "2026-12-05",
        time: "20:00",
        location: "Kwiszaal, Gent",
        maxTeamSize: 4,
        organizerEmail: "info@quizgent.be",
        entryFee: "€20 / ploeg",
      },
    };
  }

  // Vision API call with 15s timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Extract pub quiz details from this flyer poster. Output strict JSON with keys: title (string), date (YYYY-MM-DD), time (HH:mm), location (string), maxTeamSize (integer), organizerEmail (string or null), registrationUrl (string or null), entryFee (string e.g. €20 / ploeg or null).",
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
