import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";
import { TeamSettingsClient } from "@/components/TeamSettingsClient";
import { AdminUnauthorizedDialog } from "@/components/AdminUnauthorizedDialog";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const currentMember = await requireAdminSession();
  if (!currentMember) return <AdminUnauthorizedDialog />;

  const setting = await prisma.teamSetting.findUnique({
    where: { id: "singleton" },
  });

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
        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600">
          Ploeg Instellingen
        </span>
      </div>

      <TeamSettingsClient defaultTeamName={setting?.defaultTeamName || "De Quizvrienden"} />
    </div>
  );
}
