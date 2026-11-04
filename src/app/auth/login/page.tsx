import { prisma } from "@/lib/db";
import { LoginPinClient } from "@/components/LoginPinClient";
import { Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const members = await prisma.member.findMany({
    select: {
      id: true,
      name: true,
      role: true,
      pinHash: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const loginMembers = members.map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    hasPin: m.pinHash !== null,
  }));

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center p-6">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-200">
          <Trophy className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">KwisVrienden</h1>
        <p className="mt-1 text-sm text-slate-500">Exclusief voor onze vriendengroep</p>
      </div>

      <LoginPinClient members={loginMembers} />
    </div>
  );
}
