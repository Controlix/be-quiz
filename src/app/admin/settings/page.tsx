import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Settings } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionMember } from "@/lib/auth";
import { TeamSettingsClient } from "@/components/TeamSettingsClient";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const currentMember = await getSessionMember();
  if (currentMember && currentMember.role !== "ADMIN") {
    redirect("/quizzes");
  }

  const setting = await prisma.teamSetting.findUnique({
    where: { id: "singleton" },
  });

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
        <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
          Ploeg Instellingen
        </span>
      </div>

      <TeamSettingsClient defaultTeamName={setting?.defaultTeamName || "De Quizvrienden"} />
    </div>
  );
}
