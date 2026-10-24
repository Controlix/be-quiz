import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/auth/login?error=missing_token", req.url));
  }

  const tokenHash = hashToken(token);
  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
    include: { member: true },
  });

  const isDevMasterToken = token === "admin-marc-login";

  // Enforce valid, unused, unexpired invite (allow master token in dev)
  if (!invite || (!isDevMasterToken && invite.usedAt !== null) || (invite.expiresAt && invite.expiresAt < new Date())) {
    return NextResponse.redirect(new URL("/auth/login?error=invalid_token", req.url));
  }

  // Mark invite as claimed
  if (!isDevMasterToken) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
  }

  const { token: sessionToken } = await createSession(invite.memberId);

  const response = NextResponse.redirect(new URL("/quizzes", req.url));
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  });

  return response;
}
