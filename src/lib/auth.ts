import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { hashToken, generateSecureToken } from "@/lib/crypto";
import { Member } from "@prisma/client";

export const SESSION_COOKIE_NAME = "session_token";
export const SESSION_DURATION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export async function createSession(
  memberId: string
): Promise<{ token: string; expiresAt: Date }> {
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: {
      memberId,
      tokenHash,
      expiresAt,
    },
  });

  return { token: rawToken, expiresAt };
}

export async function validateSession(token: string): Promise<{ member: Member } | null> {
  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { member: true },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return { member: session.member };
}

export async function getSessionMember(): Promise<Member | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const result = await validateSession(token);
    return result?.member || null;
  } catch {
    return null;
  }
}
