import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionMember } from "@/lib/auth";
import { AdminFeedbackClient } from "@/components/AdminFeedbackClient";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  const currentMember = await getSessionMember();
  if (!currentMember || currentMember.role !== "ADMIN") {
    redirect("/quizzes");
  }

  const feedbacks = await prisma.feedback.findMany({
    include: {
      member: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="flex-1 flex flex-col p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pt-1">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 text-sm font-semibold p-1 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Admin Hub</span>
        </Link>
        <span className="text-xs text-rose-600 font-bold bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
          Feedback & Meldingen
        </span>
      </div>

      <AdminFeedbackClient initialFeedbacks={feedbacks} />
    </div>
  );
}
