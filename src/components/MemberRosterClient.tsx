"use client";

import { useState } from "react";
import { UserPlus, Copy, Check, Users, Shield, ArrowDown, ArrowUp } from "lucide-react";
import {
  adminAddMemberAction,
  adminResetMemberPinAction,
  adminUpdateMemberRoleAction,
} from "@/actions/adminActions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AlertDialog } from "@/components/AlertDialog";

interface MemberRosterClientProps {
  initialMembers: any[];
  currentMemberId?: string;
}

export function MemberRosterClient({ initialMembers, currentMemberId }: MemberRosterClientProps) {
  const [members, setMembers] = useState(initialMembers);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [selectedRoleChange, setSelectedRoleChange] = useState<{
    member: any;
    targetRole: "USER" | "ADMIN";
  } | null>(null);
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);
  const [pinResetMember, setPinResetMember] = useState<{ id: string; name: string } | null>(null);

  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel?: string;
    variant?: "error" | "warning" | "info" | "success";
    onAction?: () => void;
  } | null>(null);

  // Pure state derivations (Invariant 6)
  const admins = members.filter((m) => m.role === "ADMIN");
  const regularMembers = members.filter((m) => m.role === "USER");

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

  const handleConfirmResetPin = async () => {
    if (!pinResetMember) return;
    const { id: memberId, name: memberName } = pinResetMember;
    setPinResetMember(null);

    const res = await adminResetMemberPinAction(memberId);
    if (res.success) {
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, pinHash: null } : m)));
      setAlertState({
        isOpen: true,
        title: "PIN Gereset",
        message: `PIN van ${memberName} is gereset. Bij de volgende aanmelding kan een nieuwe PIN worden gekozen.`,
        variant: "success",
        actionLabel: "Begrepen",
      });
    } else {
      if (res.error === "Niet geautoriseerd.") {
        setAlertState({
          isOpen: true,
          title: "Toegang Gewijzigd",
          message:
            "Je beheerdersrechten zijn gewijzigd of ingetrokken door een andere beheerder. Je kunt deze actie niet meer uitvoeren.",
          actionLabel: "Naar Quizzen",
          variant: "warning",
          onAction: () => {
            window.location.href = "/quizzes";
          },
        });
      } else {
        setAlertState({
          isOpen: true,
          title: "Actie Mislukt",
          message: res.error || "Kon PIN niet resetten.",
          variant: "error",
        });
      }
    }
  };

  const handleConfirmRoleChange = async () => {
    if (!selectedRoleChange || isSubmittingRole) return;

    setIsSubmittingRole(true);
    const { member, targetRole } = selectedRoleChange;
    const res = await adminUpdateMemberRoleAction(member.id, targetRole);
    setIsSubmittingRole(false);

    if (res.success) {
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: targetRole } : m)));
      setSelectedRoleChange(null);
    } else {
      if (res.error === "Niet geautoriseerd.") {
        setSelectedRoleChange(null);
        setAlertState({
          isOpen: true,
          title: "Toegang Gewijzigd",
          message:
            "Je beheerdersrechten zijn gewijzigd of ingetrokken door een andere beheerder. Je kunt deze actie niet meer uitvoeren.",
          actionLabel: "Naar Quizzen",
          variant: "warning",
          onAction: () => {
            window.location.href = "/quizzes";
          },
        });
      } else {
        setAlertState({
          isOpen: true,
          title: "Actie Mislukt",
          message: res.error || "Kon rol niet wijzigen.",
          variant: "error",
        });
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

      {/* Section 1: Beheerders */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Shield className="h-4 w-4 text-blue-600" />
            <span>Beheerders ({admins.length})</span>
          </h3>
          <span className="text-[11px] text-slate-500">Volledig beheer van quizzen & vrienden</span>
        </div>

        <ul className="divide-y divide-slate-100">
          {admins.map((m) => {
            const isSelf = m.id === currentMemberId;
            return (
              <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{m.name}</span>
                  {isSelf && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-slate-600 uppercase">
                      JIJ
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isSelf ? (
                    <span className="text-[10px] text-slate-400 italic">Geen zelf-degradatie</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedRoleChange({ member: m, targetRole: "USER" })}
                      disabled={isSubmittingRole}
                      className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 disabled:opacity-50"
                    >
                      <ArrowDown className="h-3 w-3" />
                      <span>Naar Leden</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setPinResetMember({ id: m.id, name: m.name })}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-800"
                  >
                    Reset PIN
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Section 2: Leden */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Users className="h-4 w-4 text-blue-600" />
            <span>Leden ({regularMembers.length})</span>
          </h3>
          <span className="text-[11px] text-slate-500">Quiz teamgenoten</span>
        </div>

        <ul className="divide-y divide-slate-100">
          {regularMembers.length === 0 ? (
            <li className="py-2.5 text-xs text-slate-400 italic">Geen gewone leden aanwezig.</li>
          ) : (
            regularMembers.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium text-slate-800">{m.name}</span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRoleChange({ member: m, targetRole: "ADMIN" })}
                    disabled={isSubmittingRole}
                    className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-700 disabled:opacity-50"
                  >
                    <ArrowUp className="h-3 w-3" />
                    <span>Maak Beheerder</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPinResetMember({ id: m.id, name: m.name })}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-800"
                  >
                    Reset PIN
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Role Change Confirmation Dialog */}
      <ConfirmDialog
        isOpen={selectedRoleChange !== null}
        title={
          selectedRoleChange?.targetRole === "ADMIN"
            ? `${selectedRoleChange?.member?.name} promoveren naar Beheerder?`
            : `${selectedRoleChange?.member?.name} degraderen naar Lid?`
        }
        message={
          selectedRoleChange?.targetRole === "ADMIN"
            ? `${selectedRoleChange?.member?.name} krijgt volledige rechten om quizzen toe te voegen, details te bewerken, teaminschrijvingen te wijzigen en vrienden te beheren.`
            : `${selectedRoleChange?.member?.name} verliest beheerderstoegang en wordt een gewone speler.`
        }
        confirmLabel={
          selectedRoleChange?.targetRole === "ADMIN" ? "Ja, Maak Beheerder" : "Ja, Maak Lid"
        }
        isDestructive={selectedRoleChange?.targetRole === "USER"}
        onConfirm={handleConfirmRoleChange}
        onCancel={() => setSelectedRoleChange(null)}
      />

      {/* PIN Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={pinResetMember !== null}
        title={`PIN van ${pinResetMember?.name} Resetten?`}
        message={`Weet je zeker dat je de PIN van ${pinResetMember?.name} wilt resetten? Bij de volgende aanmelding kan deze persoon een nieuwe 4-cijferige PIN instellen.`}
        confirmLabel="Ja, Reset PIN"
        cancelLabel="Annuleren"
        onConfirm={handleConfirmResetPin}
        onCancel={() => setPinResetMember(null)}
      />

      {/* Alert / Warning / Error Dialog */}
      <AlertDialog
        isOpen={alertState?.isOpen ?? false}
        title={alertState?.title ?? ""}
        message={alertState?.message ?? ""}
        actionLabel={alertState?.actionLabel}
        variant={alertState?.variant}
        onClose={() => {
          if (alertState?.onAction) {
            alertState.onAction();
          } else {
            setAlertState(null);
          }
        }}
      />
    </div>
  );
}
