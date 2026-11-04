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
    <div className="flex flex-1 flex-col p-4 pb-20">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between pt-1">
        <Link
          href="/admin"
          className="-ml-1 inline-flex items-center gap-1 rounded-lg p-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Admin Hub</span>
        </Link>
        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-600">
          Feedback & Meldingen
        </span>
      </div>

      <AdminFeedbackClient initialFeedbacks={feedbacks} />
    </div>
  );
}
