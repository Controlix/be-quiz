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
    <div className="flex-1 flex flex-col p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <Link
          href="/quizzes"
          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-xs font-semibold p-1 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>KwisAgenda</span>
        </Link>
        <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200 text-xs font-bold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Admin Hub</span>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Beheer & Instellingen</h1>
        <p className="text-xs text-slate-500 mt-1">
          Kies een onderdeel om wijzigingen door te voeren of feedback te inspecteren.
        </p>
      </div>

      {/* Navigation Cards */}
      <div className="space-y-3">
        {/* Feedback & Bug Reporting */}
        <Link
          href="/admin/feedback"
          className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                  Feedback & Problemen
                </h3>
                {openFeedbackCount > 0 ? (
                  <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {openFeedbackCount} open
                  </span>
                ) : (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    Bijgewerkt
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Bekijk ingediende bugs, suggesties en gemaakte screenshots.
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
        </Link>

        {/* Member & PIN Management */}
        <Link
          href="/admin/members"
          className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                  Vrienden & PIN Beheer
                </h3>
                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {totalMembers} leden
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Overzicht van alle leden, WhatsApp uitnodigingslinks en PIN resets.
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
        </Link>

        {/* Team Settings */}
        <Link
          href="/admin/settings"
          className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                  Teaminstellingen
                </h3>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {teamSetting?.defaultTeamName || "Ben in Black"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Wijzig de standaard ploegnaam en algemene quizvoorkeuren.
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
        </Link>
      </div>
    </div>
  );
}
