import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MessageSquare, Users, Settings, ChevronRight, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const currentMember = await getSessionMember();
  if (!currentMember || currentMember.role !== "ADMIN") {
    redirect("/quizzes");
  }

  const [openFeedbackCount, totalMembers, teamSetting] = await Promise.all([
    prisma.feedback.count({ where: { isResolved: false } }),
    prisma.member.count(),
    prisma.teamSetting.findUnique({ where: { id: "singleton" } }),
  ]);

  return (
    <div className="flex flex-1 flex-col p-4 pb-20">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between pt-2">
        <Link
          href="/quizzes"
          className="-ml-1 inline-flex items-center gap-1.5 rounded-lg p-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>KwisAgenda</span>
        </Link>
        <div className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Admin Hub</span>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Beheer & Instellingen</h1>
        <p className="mt-1 text-xs text-slate-500">
          Kies een onderdeel om wijzigingen door te voeren of feedback te inspecteren.
        </p>
      </div>

      {/* Navigation Cards */}
      <div className="space-y-3">
        {/* Feedback & Bug Reporting */}
        <Link
          href="/admin/feedback"
          className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-400 hover:shadow-md"
        >
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 transition-colors group-hover:text-blue-600">
                  Feedback & Problemen
                </h3>
                {openFeedbackCount > 0 ? (
                  <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    {openFeedbackCount} open
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Bijgewerkt
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Bekijk ingediende bugs, suggesties en gemaakte screenshots.
              </p>
            </div>
          </div>
          <ChevronRight className="ml-2 h-4 w-4 shrink-0 text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-slate-700" />
        </Link>

        {/* Member & PIN Management */}
        <Link
          href="/admin/members"
          className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-400 hover:shadow-md"
        >
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 transition-colors group-hover:text-blue-600">
                  Vrienden & PIN Beheer
                </h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {totalMembers} leden
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Overzicht van alle leden, WhatsApp uitnodigingslinks en PIN resets.
              </p>
            </div>
          </div>
          <ChevronRight className="ml-2 h-4 w-4 shrink-0 text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-slate-700" />
        </Link>

        {/* Team Settings */}
        <Link
          href="/admin/settings"
          className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-400 hover:shadow-md"
        >
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 transition-colors group-hover:text-blue-600">
                  Teaminstellingen
                </h3>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  {teamSetting?.defaultTeamName || "Ben in Black"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Wijzig de standaard ploegnaam en algemene quizvoorkeuren.
              </p>
            </div>
          </div>
          <ChevronRight className="ml-2 h-4 w-4 shrink-0 text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-slate-700" />
        </Link>
      </div>
    </div>
  );
}
