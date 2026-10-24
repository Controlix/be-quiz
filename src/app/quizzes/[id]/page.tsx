import { notFound } from "next/navigation";
import { getQuizById } from "@/services/quizService";
import { prisma } from "@/lib/db";
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

  // Find or default to first admin member
  const adminMember = await prisma.member.findFirst({
    where: { role: "ADMIN" },
  });
  const currentMemberId = adminMember?.id || "admin-seed-id";

  return <QuizDetailClient quiz={quiz} currentMemberId={currentMemberId} />;
}
