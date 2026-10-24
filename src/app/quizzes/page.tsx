import { redirect } from "next/navigation";
import { getSessionMember } from "@/lib/auth";
import { getAllQuizzes } from "@/services/quizService";
import { QuizzesDashboard } from "@/components/QuizzesDashboard";

export const dynamic = "force-dynamic";

export default async function QuizzesPage() {
  const currentMember = await getSessionMember();
  if (!currentMember) {
    redirect("/auth/login");
  }

  const quizzes = await getAllQuizzes();
  return <QuizzesDashboard initialQuizzes={quizzes} />;
}
