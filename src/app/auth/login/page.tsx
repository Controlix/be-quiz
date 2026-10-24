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
    <div className="flex-1 flex flex-col justify-center p-6 max-w-sm mx-auto w-full">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-blue-200">
          <Trophy className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">KwisVrienden</h1>
        <p className="text-sm text-slate-500 mt-1">Exclusief voor onze vriendengroep</p>
      </div>

      <LoginPinClient members={loginMembers} />
    </div>
  );
}
