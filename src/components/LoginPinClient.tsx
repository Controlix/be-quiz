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
    <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {!selectedMember ? (
        <div className="space-y-4">
          <div>
            <label className="mb-2 block flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <User className="h-4 w-4 text-blue-600" />
              <span>Wie ben jij?</span>
            </label>
            <p className="mb-3 text-xs text-slate-500">
              Kies jouw naam om aan te melden met je persoonlijke 4-cijferige pincode.
            </p>
            <div className="grid max-h-60 grid-cols-1 gap-2 overflow-y-auto pr-1">
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
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-left transition-all hover:border-blue-500 hover:bg-blue-50/50 active:scale-[0.99]"
                >
                  <span className="text-sm font-semibold text-slate-900">{m.name}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                    {m.hasPin ? "PIN ingesteld" : "Nieuw (kies PIN)"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <p className="text-xs text-slate-500">Aanmelden als:</p>
              <h3 className="text-base font-bold text-slate-900">{selectedMember.name}</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedMemberId("");
                setPin("");
                setConfirmPin("");
                setError(null);
              }}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Wijzig
            </button>
          </div>

          <div>
            <label className="mb-1 block flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Lock className="h-3.5 w-3.5 text-blue-600" />
              <span>
                {selectedMember.hasPin ? "Voer je 4-cijferige PIN in" : "Kies een 4-cijferige PIN"}
              </span>
            </label>
            {!selectedMember.hasPin && (
              <p className="mb-2 text-[11px] text-slate-500">
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
              className="w-full rounded-xl border border-slate-200 p-3 text-center font-mono text-2xl tracking-[0.5em] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
            />
          </div>

          {!selectedMember.hasPin && (
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
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
                className="w-full rounded-xl border border-slate-200 p-3 text-center font-mono text-2xl tracking-[0.5em] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading || pin.length !== 4 || (!selectedMember.hasPin && confirmPin.length !== 4)
            }
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-black active:scale-[0.99] disabled:opacity-50"
          >
            <span>
              {loading
                ? "Bezig..."
                : selectedMember.hasPin
                  ? "Aanmelden"
                  : "PIN Instellen & Aanmelden"}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      )}

      {/* Alternative: Invite Code */}
      <div className="border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={() => setShowInviteOption((prev) => !prev)}
          className="w-full py-1 text-center text-[11px] font-medium text-slate-500 hover:text-slate-800"
        >
          {showInviteOption
            ? "Sluit uitnodigingscode optie"
            : "Aanmelden met uitnodigingslink of code"}
        </button>

        {showInviteOption && (
          <form onSubmit={handleInviteSubmit} className="mt-2 space-y-2">
            <input
              type="text"
              value={inviteToken}
              onChange={(e) => setInviteToken(e.target.value)}
              placeholder="Plak hier je invite link of token..."
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-200"
            >
              Ga naar invite
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
