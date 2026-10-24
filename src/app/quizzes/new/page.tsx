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
    <div className="flex-1 flex flex-col p-4 pb-20">
      <div className="flex items-center justify-between mb-4 pt-1">
        <Link
          href="/quizzes"
          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 text-sm font-semibold p-1 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Overzicht</span>
        </Link>
        <span className="text-xs text-slate-400 font-medium">Nieuwe Quiz</span>
      </div>

      <QuizEntryForm currentMemberId={currentMember.id} />
    </div>
  );
}
