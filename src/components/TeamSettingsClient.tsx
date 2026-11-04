"use client";

import { useState } from "react";
import { Settings, Check } from "lucide-react";
import { adminUpdateDefaultTeamNameAction } from "@/actions/adminActions";

interface TeamSettingsClientProps {
  defaultTeamName: string;
}

export function TeamSettingsClient({ defaultTeamName: initialName }: TeamSettingsClientProps) {
  const [teamName, setTeamName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    setLoading(true);
    await adminUpdateDefaultTeamNameAction(teamName.trim());
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
        <Settings className="h-4 w-4 text-blue-600" />
        <span>Standaard Ploegnaam</span>
      </h3>

      <p className="text-xs text-slate-500">
        Deze naam wordt automatisch gebruikt bij het aanmaken van nieuwe quizzen en in de
        inschrijvingsmail naar organisatoren.
      </p>

      <form onSubmit={handleSave} className="space-y-3">
        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="bv. De Quizvrienden"
          className="w-full rounded-xl border border-slate-200 p-2.5 text-sm"
        />

        <button
          type="submit"
          disabled={loading || !teamName.trim()}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
        >
          {saved ? <Check className="h-4 w-4" /> : null}
          <span>{saved ? "Opgeslagen!" : loading ? "Opslaan..." : "Opslaan"}</span>
        </button>
      </form>
    </div>
  );
}
