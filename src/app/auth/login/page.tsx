"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Trophy, KeyRound, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const urlError = searchParams.get("error");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = tokenInput.trim();
    if (!trimmed) {
      setError("Gelieve een geldige uitnodigingscode of link in te voeren.");
      return;
    }

    let token = trimmed;
    if (trimmed.includes("token=")) {
      try {
        const url = new URL(trimmed);
        token = url.searchParams.get("token") || trimmed;
      } catch {
        const match = trimmed.match(/token=([^&]+)/);
        if (match) token = match[1];
      }
    }

    router.push(`/auth/join?token=${encodeURIComponent(token)}`);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
      {(urlError || error) && (
        <div className="flex items-center gap-2 text-xs text-red-800 bg-red-50 p-3 rounded-xl border border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>
            {urlError === "invalid_token"
              ? "Deze uitnodigingscode is ongeldig of reeds gebruikt."
              : urlError === "missing_token"
              ? "Geen geldige code gevonden in de link."
              : error}
          </span>
        </div>
      )}

      {/* Quick Access Dev Button */}
      <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-100 text-center">
        <p className="text-xs font-bold text-blue-900 mb-1 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>Snelle toegang voor testen</span>
        </p>
        <p className="text-[11px] text-blue-700/80 mb-2.5">
          Meld direct aan met het beheerder profiel van Marc.
        </p>
        <Link
          href="/auth/join?token=admin-marc-login"
          className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-[0.99]"
        >
          <span>Direct aanmelden als Marc (Admin)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="relative flex items-center justify-center">
        <div className="border-t border-slate-100 w-full" />
        <span className="bg-white px-2 text-[10px] uppercase font-bold text-slate-400 absolute">
          of met invite code
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-blue-600" />
            <span>Uitnodigingscode of link</span>
          </label>
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Plak hier je code of link..."
            className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 px-4 bg-slate-900 hover:bg-black text-white font-bold text-sm rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.99]"
        >
          <span>Aanmelden met code</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex-1 flex flex-col justify-center p-6 max-w-sm mx-auto w-full">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-blue-200">
          <Trophy className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">KwisVrienden</h1>
        <p className="text-sm text-slate-500 mt-1">Exclusief voor onze vriendengroep</p>
      </div>

      <Suspense fallback={<div className="text-center py-6 text-xs text-slate-400">Laden...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
