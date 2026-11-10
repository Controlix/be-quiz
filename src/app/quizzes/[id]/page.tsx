import { notFound, redirect } from "next/navigation";
import { getQuizById } from "@/services/quizService";
import { getSessionMember } from "@/lib/auth";
import { getQuizRatingSummary } from "@/services/ratingService";
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

  const currentMember = await getSessionMember();
  if (!currentMember) {
    redirect("/auth/login");
  }

  const ratingSummary = await getQuizRatingSummary(quiz.id, currentMember.id);

  return (
    <QuizDetailClient
      quiz={quiz}
      currentMemberId={currentMember.id}
      currentMemberName={currentMember.name}
      isAdmin={currentMember.role === "ADMIN"}
      initialRatingSummary={ratingSummary}
    />
  );
}
