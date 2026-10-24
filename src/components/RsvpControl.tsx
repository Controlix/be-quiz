import { Check, X } from "lucide-react";

interface RsvpControlProps {
  currentStatus: "ATTENDING" | "DECLINED" | null;
  onRsvpChange: (status: "ATTENDING" | "DECLINED") => void;
  reservePosition?: number | null;
}

export function RsvpControl({
  currentStatus,
  onRsvpChange,
  reservePosition,
}: RsvpControlProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-900 text-sm">Jouw Deelname</h3>
        {currentStatus === "ATTENDING" && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
            {reservePosition ? `Reserve #${reservePosition}` : "In de ploeg"}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onRsvpChange("ATTENDING")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
            currentStatus === "ATTENDING"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
          }`}
        >
          <Check className="w-4 h-4" />
          <span>Ik doe mee</span>
        </button>

        <button
          onClick={() => onRsvpChange("DECLINED")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
            currentStatus === "DECLINED"
              ? "bg-red-600 text-white shadow-sm"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
          }`}
        >
          <X className="w-4 h-4" />
          <span>Kan niet</span>
        </button>
      </div>

      {reservePosition && currentStatus === "ATTENDING" && (
        <p className="text-xs text-amber-700 mt-2.5 bg-amber-50 p-2 rounded-lg border border-amber-200">
          De ploeg is momenteel vol. Je staat op positie #{reservePosition} van de reservelijst. Zodra iemand afzegt, schuif je automatisch door!
        </p>
      )}
    </div>
  );
}
