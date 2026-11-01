import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { getGoogleCalendarClient } from "@/features/calendar/shared/googleCalendarClient";
import { GoogleCalendarEventPayload } from "@/features/calendar/shared/formatter";

describe("GoogleCalendarClient", () => {
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const escapedPrivateKey = privateKey.replace(/\n/g, "\\n");

  const validEnv = {
    GOOGLE_CALENDAR_ID: "team-cal-id@group.calendar.google.com",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "quiz-sync@project.iam.gserviceaccount.com",
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: escapedPrivateKey,
  };

  const samplePayload: GoogleCalendarEventPayload = {
    summary: "Test Pub Quiz",
    location: "Test Venue, Gent",
    start: { dateTime: "2026-11-20T19:00:00.000Z", timeZone: "Europe/Brussels" },
    end: { dateTime: "2026-11-20T22:00:00.000Z", timeZone: "Europe/Brussels" },
    description: "Ploeg: Alice, Bob\nInschrijvingsgeld: €20 (Betaald)",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null if required env variables are missing", () => {
    expect(getGoogleCalendarClient({})).toBeNull();
    expect(
      getGoogleCalendarClient({
        GOOGLE_SERVICE_ACCOUNT_EMAIL: "sync@test.iam.gserviceaccount.com",
      })
    ).toBeNull();
    expect(
      getGoogleCalendarClient({
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: escapedPrivateKey,
      })
    ).toBeNull();
  });

  it("unescapes multiline private keys containing literal \\n", () => {
    const client = getGoogleCalendarClient(validEnv);
    expect(client).not.toBeNull();
  });

  it("inserts event by exchanging token and calling Google Calendar REST API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const urlStr = url.toString();
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({ access_token: "mock-bearer-token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("/events")) {
        expect(init?.method).toBe("POST");
        expect(init?.headers).toEqual(
          expect.objectContaining({
            Authorization: "Bearer mock-bearer-token",
            "Content-Type": "application/json",
          })
        );
        const parsedBody = JSON.parse(init?.body as string);
        expect(parsedBody.summary).toBe("Test Pub Quiz");
        return new Response(JSON.stringify({ id: "gcal-event-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    });

    const client = getGoogleCalendarClient(validEnv);
    expect(client).not.toBeNull();

    const result = await client!.insertEvent("test-calendar-id", samplePayload);
    expect(result).toEqual({ id: "gcal-event-123" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("updates event with PUT request", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const urlStr = url.toString();
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({ access_token: "mock-bearer-token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("/events/gcal-event-123")) {
        expect(init?.method).toBe("PUT");
        return new Response(JSON.stringify({ id: "gcal-event-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    });

    const client = getGoogleCalendarClient(validEnv);
    const result = await client!.updateEvent("test-calendar-id", "gcal-event-123", samplePayload);
    expect(result).toEqual({ updated: true });
  });

  it("handles 404 and 410 cleanly on updateEvent returning notFound status", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({ access_token: "mock-bearer-token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("event-404")) {
        return new Response("Not Found", { status: 404 });
      }
      if (urlStr.includes("event-410")) {
        return new Response("Gone", { status: 410 });
      }
      return new Response(JSON.stringify({ id: "ok" }), { status: 200 });
    });

    const client = getGoogleCalendarClient(validEnv);
    const res404 = await client!.updateEvent("test-cal", "event-404", samplePayload);
    expect(res404).toEqual({ updated: false, notFound: true });

    const res410 = await client!.updateEvent("test-cal", "event-410", samplePayload);
    expect(res410).toEqual({ updated: false, notFound: true });
  });

  it("handles 404 and 410 cleanly on deleteEvent without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const urlStr = url.toString();
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({ access_token: "mock-bearer-token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("event-404")) {
        return new Response("Not Found", { status: 404 });
      }
      if (urlStr.includes("event-410")) {
        return new Response("Gone", { status: 410 });
      }
      return new Response(null, { status: 204 });
    });

    const client = getGoogleCalendarClient(validEnv);
    await expect(
      client!.deleteEvent("test-calendar-id", "event-404")
    ).resolves.toBeUndefined();
    await expect(
      client!.deleteEvent("test-calendar-id", "event-410")
    ).resolves.toBeUndefined();
  });

  it("re-uses cached access token for subsequent requests within expiry", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({ access_token: "cached-bearer-token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ id: "gcal-event-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = getGoogleCalendarClient(validEnv);
    await client!.insertEvent("test-cal", samplePayload);
    await client!.updateEvent("test-cal", "gcal-event-123", samplePayload);

    // 1 token exchange + 2 calendar api calls = 3 fetches total
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("throws error when API returns non-2xx status (not 404/410 on delete)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({ access_token: "mock-token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" });
    });

    const client = getGoogleCalendarClient(validEnv);
    await expect(client!.insertEvent("test-cal", samplePayload)).rejects.toThrow(
      "Google Calendar API error"
    );
  });
});
