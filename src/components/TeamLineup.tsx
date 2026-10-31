"use client";

import { useState, useRef, useEffect } from "react";
import { GripVertical } from "lucide-react";

export interface LineupMember {
  id: string;
  name: string;
  queuedSince: Date;
}

export interface DeclinedMember {
  id: string;
  name: string;
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
  declinedMembers?: DeclinedMember[];
  maxTeamSize: number;
  isAdmin?: boolean;
  onAdminOverrideDecline?: (memberId: string) => void;
  onAdminOverrideAttend?: (memberId: string) => void;
  onReorder?: (sourceIndex: number, destinationIndex: number) => Promise<void> | void;
}

export function TeamLineup({
  attendees,
  declinedMembers = [],
  maxTeamSize,
  isAdmin = false,
  onAdminOverrideDecline,
  onAdminOverrideAttend,
  onReorder,
}: TeamLineupProps) {
  const sortedAttendees = [...attendees].sort(
    (a, b) => new Date(a.queuedSince).getTime() - new Date(b.queuedSince).getTime()
  );
  const { active, reserves } = partitionLineup(sortedAttendees, maxTeamSize);
  const isComplete = active.length >= maxTeamSize;

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const touchStartIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setDraggedIndex(null);
      setDragOverIndex(null);
    };

    window.addEventListener("dragend", handleGlobalDragEnd);
    window.addEventListener("drop", handleGlobalDragEnd);

    return () => {
      window.removeEventListener("dragend", handleGlobalDragEnd);
      window.removeEventListener("drop", handleGlobalDragEnd);
    };
  }, []);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      onReorder?.(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleTouchStart = (index: number) => {
    touchStartIndexRef.current = index;
    setDraggedIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const row = target?.closest("[data-roster-index]");
    if (row) {
      const idx = Number(row.getAttribute("data-roster-index"));
      if (!isNaN(idx) && idx !== dragOverIndex) {
        setDragOverIndex(idx);
      }
    }
  };

  const handleTouchEnd = () => {
    if (
      touchStartIndexRef.current !== null &&
      dragOverIndex !== null &&
      touchStartIndexRef.current !== dragOverIndex
    ) {
      onReorder?.(touchStartIndexRef.current, dragOverIndex);
    }
    touchStartIndexRef.current = null;
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

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
      <ul className="space-y-1.5 mb-3">
        {active.map((member, idx) => {
          const overallIndex = idx;
          const isBeingDragged = draggedIndex === overallIndex;
          const isTarget = dragOverIndex === overallIndex;

          return (
            <li
              key={member.id}
              data-roster-index={overallIndex}
              draggable={isAdmin}
              onDragStart={(e) => handleDragStart(e, overallIndex)}
              onDragOver={(e) => handleDragOver(e, overallIndex)}
              onDrop={(e) => handleDrop(e, overallIndex)}
              className={`flex items-center justify-between text-sm py-1.5 px-2 rounded-xl transition-all ${
                isBeingDragged
                  ? "opacity-40 bg-slate-100"
                  : isTarget
                  ? "bg-blue-50 border border-blue-300"
                  : "hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isAdmin && (
                  <div
                    onTouchStart={() => handleTouchStart(overallIndex)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-400 hover:text-slate-600 touch-none shrink-0"
                    title="Sleep om volgorde te wijzigen"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>
                )}
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="font-medium text-slate-800 truncate">{member.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
          );
        })}
        {Array.from({ length: Math.max(0, maxTeamSize - active.length) }).map((_, idx) => (
          <li
            key={`empty-${idx}`}
            className="flex items-center gap-2 text-sm text-slate-400 py-1.5 px-2 italic"
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
            {reserves.map((member, idx) => {
              const overallIndex = active.length + idx;
              const isBeingDragged = draggedIndex === overallIndex;
              const isTarget = dragOverIndex === overallIndex;

              return (
                <li
                  key={member.id}
                  data-roster-index={overallIndex}
                  draggable={isAdmin}
                  onDragStart={(e) => handleDragStart(e, overallIndex)}
                  onDragOver={(e) => handleDragOver(e, overallIndex)}
                  onDrop={(e) => handleDrop(e, overallIndex)}
                  className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-xl transition-all border ${
                    isBeingDragged
                      ? "opacity-40 bg-amber-100/50 border-amber-300"
                      : isTarget
                      ? "bg-blue-50 border-blue-400"
                      : "bg-amber-50/70 text-amber-900 border-amber-200"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isAdmin && (
                      <div
                        onTouchStart={() => handleTouchStart(overallIndex)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-amber-500 hover:text-amber-700 touch-none shrink-0"
                        title="Sleep om volgorde te wijzigen"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                    )}
                    <span className="font-medium truncate">{member.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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
              );
            })}
          </ul>
        </div>
      )}

      {/* Declined List */}
      {declinedMembers && declinedMembers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-500 mb-2">
            Afgemeld ({declinedMembers.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {declinedMembers.map((member) => (
              <span
                key={member.id}
                className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200"
              >
                <span className="text-slate-400 font-bold">✕</span>
                <span className="font-medium">{member.name}</span>
                {isAdmin && onAdminOverrideAttend && (
                  <button
                    type="button"
                    onClick={() => onAdminOverrideAttend(member.id)}
                    className="ml-1 text-[10px] font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 px-1.5 py-0.5 rounded-full transition-colors"
                    title="Meld deze speler aan"
                  >
                    + Aanmelden
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
