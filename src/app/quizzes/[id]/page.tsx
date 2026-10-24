import { notFound } from "next/navigation";
import { getQuizById } from "@/services/quizService";
import { prisma } from "@/lib/db";
import { getSessionMember } from "@/lib/auth";
import { QuizDetailClient } from "@/components/QuizDetailClient";

export const dynamic = "force-dynamic";

interface QuizPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuizDetailPage({ params }: QuizPageProps) {
  const { id } = await params;
  const quiz = await getQuizById(id);

  if (!quiz) {
    notFound();
  }

  // Load authenticated session member or fallback to initial seeded admin
  const sessionMember = await getSessionMember();
  const currentMember = sessionMember || (await prisma.member.findFirst({
    where: { role: "ADMIN" },
  })) || {
    id: "admin-seed-id",
    name: "Marc",
    role: "ADMIN",
  };

  return (
    <QuizDetailClient
      quiz={quiz}
      currentMemberId={currentMember.id}
      currentMemberName={currentMember.name}
      isAdmin={currentMember.role === "ADMIN"}
    />
  );
}
