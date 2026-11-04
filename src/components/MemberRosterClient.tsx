"use client";

import { useState } from "react";
import { UserPlus, Copy, Check, Users } from "lucide-react";
import { adminAddMemberAction, adminResetMemberPinAction } from "@/actions/adminActions";

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
      setMembers((prev) => [...prev, { id: res.memberId, name: name.trim(), role: "USER" }]);
      setName("");
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => copyFallback(text));
    } else {
      copyFallback(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyFallback = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    } catch (err) {
      console.warn("Copy fallback failed:", err);
    }
  };

  const handleResetPin = async (memberId: string, memberName: string) => {
    if (window.confirm(`Weet je zeker dat je de PIN van ${memberName} wilt resetten?`)) {
      const res = await adminResetMemberPinAction(memberId);
      if (res.success) {
        setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, pinHash: null } : m)));
        alert(
          `PIN van ${memberName} is gereset. Bij de volgende aanmelding kan een nieuwe PIN worden gekozen.`
        );
      } else {
        alert(res.error || "Kon PIN niet resetten.");
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Add member card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <UserPlus className="h-4 w-4 text-blue-600" />
          <span>Nieuwe Vriend Toevoegen</span>
        </h3>

        <form onSubmit={handleAddMember} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Voornaam (bv. Laura)"
            className="w-full rounded-xl border border-slate-200 p-2.5 text-sm"
          />

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Toevoegen..." : "Vriend Toevoegen & Link Maken"}
          </button>
        </form>

        {newInviteUrl && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="mb-1 text-xs font-semibold text-emerald-800">
              Uitnodigingslink gegenereerd:
            </p>
            <div className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-white p-1.5 text-xs">
              <span className="flex-1 truncate text-slate-600">{newInviteUrl}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(newInviteUrl)}
                className="rounded p-1 text-emerald-700 hover:bg-emerald-50"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Roster list */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <Users className="h-4 w-4 text-blue-600" />
          <span>Vriendenlijst ({members.length})</span>
        </h3>

        <ul className="divide-y divide-slate-100">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="font-medium text-slate-800">{m.name}</span>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-600 uppercase">
                  {m.role}
                </span>
                <button
                  type="button"
                  onClick={() => handleResetPin(m.id, m.name)}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-800"
                >
                  Reset PIN
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
