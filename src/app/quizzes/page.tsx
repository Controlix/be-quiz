import { redirect } from "next/navigation";
import { getSessionMember } from "@/lib/auth";
import { getAllQuizzes, getDefaultTeamName } from "@/services/quizService";
import { getBatchQuizRatings } from "@/services/ratingService";
import { QuizzesDashboard } from "@/components/QuizzesDashboard";

export const dynamic = "force-dynamic";

export default async function QuizzesPage() {
  const currentMember = await getSessionMember();
  if (!currentMember) {
    redirect("/auth/login");
  }

  const [quizzes, teamName] = await Promise.all([getAllQuizzes(), getDefaultTeamName()]);
  const quizIds = quizzes.map((q) => q.id);
  const batchRatings = await getBatchQuizRatings(quizIds);
  const ratingsMap = Object.fromEntries(batchRatings);

  return (
    <QuizzesDashboard
      initialQuizzes={quizzes}
      isAdmin={currentMember.role === "ADMIN"}
      teamName={teamName}
      ratingsMap={ratingsMap}
    />
  );
}
