"use client";

import { AlertTriangle, AlertCircle, Info, CheckCircle } from "lucide-react";

export interface AlertDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  actionLabel?: string;
  variant?: "error" | "warning" | "info" | "success";
  onClose: () => void;
}

export function AlertDialog({
  isOpen,
  title,
  message,
  actionLabel = "Sluiten",
  variant = "error",
  onClose,
}: AlertDialogProps) {
  if (!isOpen) return null;

  const iconConfig = {
    warning: {
      icon: AlertTriangle,
      badgeBg: "bg-amber-50 text-amber-600",
      btnBg: "bg-amber-600 hover:bg-amber-700",
    },
    error: {
      icon: AlertCircle,
      badgeBg: "bg-red-50 text-red-600",
      btnBg: "bg-red-600 hover:bg-red-700",
    },
    info: {
      icon: Info,
      badgeBg: "bg-blue-50 text-blue-600",
      btnBg: "bg-blue-600 hover:bg-blue-700",
    },
    success: {
      icon: CheckCircle,
      badgeBg: "bg-emerald-50 text-emerald-600",
      btnBg: "bg-emerald-600 hover:bg-emerald-700",
    },
  }[variant];

  const Icon = iconConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="animate-in fade-in zoom-in-95 w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-6 shadow-xl duration-150">
        <div className="mb-3 flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconConfig.badgeBg}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
        </div>

        <p className="mb-6 text-xs leading-relaxed text-slate-600">{message}</p>

        <div>
          <button
            type="button"
            onClick={onClose}
            className={`w-full rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all active:scale-95 ${iconConfig.btnBg}`}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
