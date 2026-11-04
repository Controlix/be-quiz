import { Check, X } from "lucide-react";

interface RsvpControlProps {
  currentStatus: "ATTENDING" | "DECLINED" | null;
  onRsvpChange: (status: "ATTENDING" | "DECLINED") => void;
  reservePosition?: number | null;
}

export function RsvpControl({ currentStatus, onRsvpChange, reservePosition }: RsvpControlProps) {
  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Jouw Deelname</h3>
        {currentStatus === "ATTENDING" && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
            {reservePosition ? `Reserve #${reservePosition}` : "In de ploeg"}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onRsvpChange("ATTENDING")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            currentStatus === "ATTENDING"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Check className="h-4 w-4" />
          <span>Ik doe mee</span>
        </button>

        <button
          onClick={() => onRsvpChange("DECLINED")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            currentStatus === "DECLINED"
              ? "bg-red-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <X className="h-4 w-4" />
          <span>Kan niet</span>
        </button>
      </div>

      {reservePosition && currentStatus === "ATTENDING" && (
        <p className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
          De ploeg is momenteel vol. Je staat op positie #{reservePosition} van de reservelijst.
          Zodra iemand afzegt, schuif je automatisch door!
        </p>
      )}
    </div>
  );
}
