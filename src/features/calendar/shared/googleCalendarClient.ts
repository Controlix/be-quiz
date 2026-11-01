import crypto from "node:crypto";
import { GoogleCalendarEventPayload } from "./formatter";

export interface UpdateEventResult {
  updated: boolean;
  notFound?: boolean;
}

export interface GoogleCalendarClient {
  insertEvent(
    calendarId: string,
    payload: GoogleCalendarEventPayload
  ): Promise<{ id: string }>;
  updateEvent(
    calendarId: string,
    eventId: string,
    payload: GoogleCalendarEventPayload
  ): Promise<UpdateEventResult>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
}

function base64url(input: string | Buffer): string {
  if (typeof input === "string") {
    return Buffer.from(input, "utf8").toString("base64url");
  }
  return input.toString("base64url");
}

function createServiceAccountJwt(email: string, privateKey: string): string {
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: email,
    scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const message = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(message);
  const signature = signer.sign(privateKey, "base64url");

  return `${message}.${signature}`;
}

export function getGoogleCalendarClient(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): GoogleCalendarClient | null {
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    return null;
  }

  const validEmail: string = email;
  const privateKey: string = rawKey.replace(/\\n/g, "\n");

  let cachedToken: string | null = null;
  let tokenExpiresAt = 0;

  async function getAccessToken(): Promise<string> {
    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt - 60000) {
      return cachedToken;
    }

    const assertion = createServiceAccountJwt(validEmail, privateKey);
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    });

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Google Calendar API token exchange error: ${res.status} ${res.statusText} - ${errText}`
      );
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
    return cachedToken;
  }

  return {
    async insertEvent(
      calendarId: string,
      payload: GoogleCalendarEventPayload
    ): Promise<{ id: string }> {
      const token = await getAccessToken();
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(
          `Google Calendar API error on insertEvent: ${res.status} ${res.statusText} - ${errText}`
        );
      }

      const data = (await res.json()) as { id: string };
      return { id: data.id };
    },

    async updateEvent(
      calendarId: string,
      eventId: string,
      payload: GoogleCalendarEventPayload
    ): Promise<UpdateEventResult> {
      const token = await getAccessToken();
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events/${encodeURIComponent(eventId)}`;

      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 404 || res.status === 410) {
        return { updated: false, notFound: true };
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(
          `Google Calendar API error on updateEvent: ${res.status} ${res.statusText} - ${errText}`
        );
      }

      return { updated: true };
    },

    async deleteEvent(calendarId: string, eventId: string): Promise<void> {
      const token = await getAccessToken();
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events/${encodeURIComponent(eventId)}`;

      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // HTTP 404 Not Found and 410 Gone are treated as successful deletions
      if (res.status === 404 || res.status === 410 || res.ok) {
        return;
      }

      const errText = await res.text().catch(() => "");
      throw new Error(
        `Google Calendar API error on deleteEvent: ${res.status} ${res.statusText} - ${errText}`
      );
    },
  };
}
