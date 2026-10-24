"use client";

import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Bevestigen",
  cancelLabel = "Annuleren",
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-3">
          {isDestructive && (
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <h3 className="font-bold text-slate-900 text-base">{title}</h3>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed mb-6">{message}</p>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold text-white shadow-sm transition-all active:scale-95 ${
              isDestructive ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
