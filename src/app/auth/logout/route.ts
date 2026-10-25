import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { getRequestOrigin } from "@/lib/requestUrl";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await prisma.session.delete({ where: { tokenHash } }).catch(() => {});
  }

  const origin = getRequestOrigin(req);
  const response = NextResponse.redirect(new URL("/auth/login", origin));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
