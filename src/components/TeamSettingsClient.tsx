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
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
        <Settings className="w-4 h-4 text-blue-600" />
        <span>Standaard Ploegnaam</span>
      </h3>

      <p className="text-xs text-slate-500">
        Deze naam wordt automatisch gebruikt bij het aanmaken van nieuwe quizzen en in de inschrijvingsmail naar organisatoren.
      </p>

      <form onSubmit={handleSave} className="space-y-3">
        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="bv. De Quizvrienden"
          className="w-full text-sm p-2.5 rounded-xl border border-slate-200"
        />

        <button
          type="submit"
          disabled={loading || !teamName.trim()}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {saved ? <Check className="w-4 h-4" /> : null}
          <span>{saved ? "Opgeslagen!" : loading ? "Opslaan..." : "Opslaan"}</span>
        </button>
      </form>
    </div>
  );
}
