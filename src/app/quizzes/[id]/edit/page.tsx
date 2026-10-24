import { notFound, redirect } from "next/navigation";
import { getQuizById } from "@/services/quizService";
import { getSessionMember } from "@/lib/auth";
import { EditQuizClient } from "@/components/EditQuizClient";

export const dynamic = "force-dynamic";

interface EditQuizPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditQuizPage({ params }: EditQuizPageProps) {
  const { id } = await params;
  const quiz = await getQuizById(id);

  if (!quiz || !quiz.team) {
    notFound();
  }

  // Server-side admin role check
  const currentMember = await getSessionMember();
  if (currentMember && currentMember.role !== "ADMIN") {
    redirect(`/quizzes/${id}`);
  }

  return (
    <EditQuizClient
      quizId={quiz.id}
      teamId={quiz.team.id}
      currentCapacity={quiz.team.maxTeamSize}
    />
  );
}
