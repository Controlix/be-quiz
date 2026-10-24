"use client";

import { useState } from "react";
import { UserPlus, Copy, Check, Users } from "lucide-react";
import { adminAddMemberAction } from "@/actions/adminActions";

interface MemberRosterClientProps {
  initialMembers: any[];
}

export function MemberRosterClient({ initialMembers }: MemberRosterClientProps) {
  const [members, setMembers] = useState(initialMembers);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    const res = await adminAddMemberAction(name.trim());
    setLoading(false);

    if (res.success && res.inviteUrl) {
      setNewInviteUrl(res.inviteUrl);
      setMembers((prev) => [
        ...prev,
        { id: res.memberId, name: name.trim(), role: "USER" },
      ]);
      setName("");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Add member card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <h3 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-1.5">
          <UserPlus className="w-4 h-4 text-blue-600" />
          <span>Nieuwe Vriend Toevoegen</span>
        </h3>

        <form onSubmit={handleAddMember} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Voornaam (bv. Laura)"
            className="w-full text-sm p-2.5 rounded-xl border border-slate-200"
          />

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? "Toevoegen..." : "Vriend Toevoegen & Link Maken"}
          </button>
        </form>

        {newInviteUrl && (
          <div className="mt-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <p className="text-xs font-semibold text-emerald-800 mb-1">
              Uitnodigingslink gegenereerd:
            </p>
            <div className="flex items-center gap-1 bg-white p-1.5 rounded-lg border border-emerald-200 text-xs">
              <span className="truncate flex-1 text-slate-600">{newInviteUrl}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(newInviteUrl)}
                className="p-1 text-emerald-700 hover:bg-emerald-50 rounded"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Roster list */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-blue-600" />
          <span>Vriendenlijst ({members.length})</span>
        </h3>

        <ul className="divide-y divide-slate-100">
          {members.map((m) => (
            <li key={m.id} className="py-2.5 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-800">{m.name}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {m.role}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
