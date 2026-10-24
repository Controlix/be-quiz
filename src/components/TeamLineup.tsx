export interface LineupMember {
  id: string;
  name: string;
  queuedSince: Date;
}

export function formatReserveBadge(index: number): string {
  return `Reserve #${index + 1}`;
}

export function partitionLineup(
  attendees: LineupMember[],
  maxTeamSize: number
): { active: LineupMember[]; reserves: LineupMember[] } {
  // Sort strictly by queuedSince ASC (FIFO)
  const sorted = [...attendees].sort(
    (a, b) => new Date(a.queuedSince).getTime() - new Date(b.queuedSince).getTime()
  );

  return {
    active: sorted.slice(0, maxTeamSize),
    reserves: sorted.slice(maxTeamSize),
  };
}

interface TeamLineupProps {
  attendees: LineupMember[];
  maxTeamSize: number;
  isAdmin?: boolean;
  onAdminOverrideDecline?: (memberId: string) => void;
}

export function TeamLineup({
  attendees,
  maxTeamSize,
  isAdmin = false,
  onAdminOverrideDecline,
}: TeamLineupProps) {
  const { active, reserves } = partitionLineup(attendees, maxTeamSize);
  const isComplete = active.length >= maxTeamSize;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Opstelling</h3>
          <p className="text-xs text-slate-500">
            {active.length} / {maxTeamSize} spelers
          </p>
        </div>
        {isComplete ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
            ✓ Ploeg Compleet
          </span>
        ) : (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
            Nog {maxTeamSize - active.length} nodig
          </span>
        )}
      </div>

      {/* Active Lineup */}
      <ul className="space-y-2 mb-3">
        {active.map((member, idx) => (
          <li key={member.id} className="flex items-center justify-between text-sm py-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <span className="font-medium text-slate-800">{member.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Speler</span>
              {isAdmin && onAdminOverrideDecline && (
                <button
                  type="button"
                  onClick={() => onAdminOverrideDecline(member.id)}
                  className="text-[10px] text-red-600 hover:text-red-700 font-semibold px-1.5 py-0.5 rounded bg-red-50 hover:bg-red-100"
                >
                  Afzeggen
                </button>
              )}
            </div>
          </li>
        ))}
        {Array.from({ length: Math.max(0, maxTeamSize - active.length) }).map((_, idx) => (
          <li
            key={`empty-${idx}`}
            className="flex items-center gap-2 text-sm text-slate-400 py-1 italic"
          >
            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 text-xs font-bold flex items-center justify-center">
              {active.length + idx + 1}
            </span>
            <span>Open plaats...</span>
          </li>
        ))}
      </ul>

      {/* Reserve List */}
      {reserves.length > 0 && (
        <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
          <h4 className="text-xs font-bold text-slate-600 mb-2">Reservelijst ({reserves.length})</h4>
          <ul className="space-y-1.5">
            {reserves.map((member, idx) => (
              <li
                key={member.id}
                className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-200"
              >
                <span className="font-medium">{member.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-700">{formatReserveBadge(idx)}</span>
                  {isAdmin && onAdminOverrideDecline && (
                    <button
                      type="button"
                      onClick={() => onAdminOverrideDecline(member.id)}
                      className="text-[10px] text-red-600 hover:text-red-700 font-semibold px-1 py-0.5 rounded bg-red-100"
                    >
                      Verwijder
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
