"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";

export interface AddGuestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGuest: (guestName: string) => Promise<void> | void;
  isSubmitting?: boolean;
}

export function AddGuestDialog({
  isOpen,
  onClose,
  onAddGuest,
  isSubmitting = false,
}: AddGuestDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Vul een naam in");
      return;
    }
    if (trimmed.length > 50) {
      setError("Naam mag maximaal 50 tekens zijn");
      return;
    }

    try {
      setError(null);
      await onAddGuest(trimmed);
      setName("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Fout bij toevoegen van gast");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl transition-all">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <UserPlus className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-slate-900">Gastspeler toevoegen</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="guest-name-input"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Naam van gastspeler
            </label>
            <input
              id="guest-name-input"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Bijv. Sarah"
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Toevoegen..." : "Toevoegen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
