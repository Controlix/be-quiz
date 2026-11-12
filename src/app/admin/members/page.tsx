import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";
import { MemberRosterClient } from "@/components/MemberRosterClient";
import { AdminUnauthorizedDialog } from "@/components/AdminUnauthorizedDialog";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const currentMember = await requireAdminSession();
  if (!currentMember) return <AdminUnauthorizedDialog />;

  const members = await prisma.member.findMany({
    include: {
      invite: true,
    },
    orderBy: {
      name: "asc",
    },
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
          Vrienden Beheer
        </span>
      </div>

      <MemberRosterClient initialMembers={members} currentMemberId={currentMember?.id} />
    </div>
  );
}
