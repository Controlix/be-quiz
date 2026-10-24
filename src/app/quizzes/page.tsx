import { getAllQuizzes } from "@/services/quizService";
import { QuizzesDashboard } from "@/components/QuizzesDashboard";

export const dynamic = "force-dynamic";

export default async function QuizzesPage() {
  const quizzes = await getAllQuizzes();
  return <QuizzesDashboard initialQuizzes={quizzes} />;
}
