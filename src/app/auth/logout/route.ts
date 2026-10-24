import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await prisma.session.delete({ where: { tokenHash } }).catch(() => {});
  }

  const response = NextResponse.redirect(new URL("/auth/login", req.url));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
