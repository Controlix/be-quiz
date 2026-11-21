"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";

export interface EnrollMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  availableMembers: Array<{ id: string; name: string }>;
  onEnroll: (memberId: string, memberName: string) => Promise<void> | void;
  isSubmitting?: boolean;
}

export function EnrollMemberDialog({
  isOpen,
  onClose,
  availableMembers,
  onEnroll,
  isSubmitting = false,
}: EnrollMemberDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);

  if (!isOpen) return null;

  const busy = isSubmitting || pendingMemberId !== null;

  const handleClose = () => {
    if (busy) return;
    setError(null);
    onClose();
  };

  const handleSelectMember = async (member: { id: string; name: string }) => {
    if (busy) return;
    setError(null);
    setPendingMemberId(member.id);
    try {
      await onEnroll(member.id, member.name);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Fout bij aanmelden van teamlid");
    } finally {
      setPendingMemberId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl transition-all">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <UserPlus className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-slate-900">Teamlid toevoegen</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            aria-label="Sluiten"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            {error}
          </p>
        )}

        {availableMembers.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Alle teamleden hebben al gereageerd.</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                disabled={busy}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Sluiten
              </button>
            </div>
          </div>
        ) : (
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {availableMembers.map((member) => {
              const isRowPending = pendingMemberId === member.id;
              return (
                <button
                  key={member.id}
                  type="button"
                  disabled={busy}
                  onClick={() => handleSelectMember(member)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-left text-sm font-medium text-slate-800 transition-colors hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>{member.name}</span>
                  {isRowPending && <span className="text-xs text-slate-400">Bezig...</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
