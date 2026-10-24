"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithPinAction, setupInitialPinAction } from "@/actions/authActions";
import { User, Lock, AlertCircle, ArrowRight } from "lucide-react";

export interface LoginMember {
  id: string;
  name: string;
  role: string;
  hasPin: boolean;
}

interface LoginPinClientProps {
  members: LoginMember[];
}

export function LoginPinClient({ members }: LoginPinClientProps) {
  const router = useRouter();
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInviteOption, setShowInviteOption] = useState(false);
  const [inviteToken, setInviteToken] = useState("");

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setError(null);

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError("PIN moet exact 4 cijfers bevatten.");
      return;
    }

    setLoading(true);

    if (selectedMember.hasPin) {
      const res = await loginWithPinAction(selectedMember.id, pin);
      if (res.success) {
        router.push("/quizzes");
      } else {
        setError(res.error || "Ongeldige PIN.");
        setLoading(false);
      }
    } else {
      if (confirmPin && pin !== confirmPin) {
        setError("De pincodes komen niet overeen.");
        setLoading(false);
        return;
      }
      const res = await setupInitialPinAction(selectedMember.id, pin);
      if (res.success) {
        router.push("/quizzes");
      } else {
        setError(res.error || "Kon PIN niet instellen.");
        setLoading(false);
      }
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inviteToken.trim();
    if (!trimmed) return;
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
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-800 bg-red-50 p-3 rounded-xl border border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {!selectedMember ? (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <User className="w-4 h-4 text-blue-600" />
              <span>Wie ben jij?</span>
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Kies jouw naam om aan te melden met je persoonlijke 4-cijferige pincode.
            </p>
            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedMemberId(m.id);
                    setPin("");
                    setConfirmPin("");
                    setError(null);
                  }}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-left transition-all active:scale-[0.99]"
                >
                  <span className="font-semibold text-sm text-slate-900">{m.name}</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {m.hasPin ? "PIN ingesteld" : "Nieuw (kies PIN)"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <p className="text-xs text-slate-500">Aanmelden als:</p>
              <h3 className="font-bold text-base text-slate-900">{selectedMember.name}</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedMemberId("");
                setPin("");
                setConfirmPin("");
                setError(null);
              }}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Wijzig
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {selectedMember.hasPin ? "Voer je 4-cijferige PIN in" : "Kies een 4-cijferige PIN"}
              </span>
            </label>
            {!selectedMember.hasPin && (
              <p className="text-[11px] text-slate-500 mb-2">
                Dit is je eerste keer. Kies een 4-cijferige pincode om voortaan snel aan te melden.
              </p>
            )}
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              autoFocus
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="w-full text-center text-2xl tracking-[0.5em] font-mono p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {!selectedMember.hasPin && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bevestig je 4-cijferige PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="w-full text-center text-2xl tracking-[0.5em] font-mono p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || pin.length !== 4 || (!selectedMember.hasPin && confirmPin.length !== 4)}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-black text-white font-bold text-sm rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] disabled:opacity-50"
          >
            <span>{loading ? "Bezig..." : selectedMember.hasPin ? "Aanmelden" : "PIN Instellen & Aanmelden"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Alternative: Invite Code */}
      <div className="pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setShowInviteOption((prev) => !prev)}
          className="w-full text-center text-[11px] text-slate-500 hover:text-slate-800 font-medium py-1"
        >
          {showInviteOption ? "Sluit uitnodigingscode optie" : "Aanmelden met uitnodigingslink of code"}
        </button>

        {showInviteOption && (
          <form onSubmit={handleInviteSubmit} className="mt-2 space-y-2">
            <input
              type="text"
              value={inviteToken}
              onChange={(e) => setInviteToken(e.target.value)}
              placeholder="Plak hier je invite link of token..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
            />
            <button
              type="submit"
              className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl"
            >
              Ga naar invite
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
