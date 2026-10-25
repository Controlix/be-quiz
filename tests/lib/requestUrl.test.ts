import { describe, it, expect } from "vitest";
import { getRequestOrigin } from "@/lib/requestUrl";

describe("Request Origin & URL Resolution", () => {
  it("resolves origin from host header", () => {
    const dummyReq = {
      headers: new Map([["host", "192.168.1.100:3000"]]),
      nextUrl: { origin: "http://0.0.0.0:3000" },
    } as any;
    dummyReq.headers.get = (k: string) => (k === "host" ? "192.168.1.100:3000" : null);

    const origin = getRequestOrigin(dummyReq);
    expect(origin).toBe("http://192.168.1.100:3000");
  });

  it("prioritizes x-forwarded-host and x-forwarded-proto", () => {
    const dummyReq = {
      headers: {
        get: (k: string) => {
          if (k === "x-forwarded-host") return "kwisvrienden.be";
          if (k === "x-forwarded-proto") return "https";
          if (k === "host") return "localhost:3000";
          return null;
        },
      },
      nextUrl: { origin: "http://0.0.0.0:3000" },
    } as any;

    const origin = getRequestOrigin(dummyReq);
    expect(origin).toBe("https://kwisvrienden.be");
  });
});
