import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionMember } from "@/lib/auth";
import { QuizEntryForm } from "@/components/QuizEntryForm";

export const dynamic = "force-dynamic";

export default async function NewQuizPage() {
  const currentMember = await getSessionMember();
  if (!currentMember) {
    redirect("/auth/login");
  }

  return (
    <div className="flex flex-1 flex-col p-4 pb-20">
      <div className="mb-4 flex items-center justify-between pt-1">
        <Link
          href="/quizzes"
          className="-ml-1 inline-flex items-center gap-1 rounded-lg p-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Overzicht</span>
        </Link>
        <span className="text-xs font-medium text-slate-400">Nieuwe Quiz</span>
      </div>

      <QuizEntryForm currentMemberId={currentMember.id} />
    </div>
  );
}
