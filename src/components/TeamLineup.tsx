"use client";

import { useState, useRef, useEffect } from "react";
import { GripVertical } from "lucide-react";

export interface LineupMember {
  id: string;
  rsvpId?: string;
  memberId?: string | null;
  name: string;
  isGuest?: boolean;
  guestName?: string | null;
  invitedById?: string | null;
  invitedByName?: string | null;
  queuedSince: Date;
}

export interface DeclinedMember {
  id: string;
  memberId?: string;
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
  isLocked?: boolean;
  currentMemberId?: string;
  onAdminOverrideDecline?: (memberId: string) => void;
  onAdminOverrideAttend?: (memberId: string) => void;
  onRemoveGuest?: (rsvpId: string) => void;
  onReorder?: (sourceIndex: number, destinationIndex: number) => Promise<void> | void;
}

export function TeamLineup({
  attendees,
  declinedMembers = [],
  maxTeamSize,
  isAdmin = false,
  isLocked = false,
  currentMemberId,
  onAdminOverrideDecline,
  onAdminOverrideAttend,
  onRemoveGuest,
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
    setDraggedIndex(null);
    setDragOverIndex(null);
    touchStartIndexRef.current = null;
  };

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Opstelling</h3>
          <p className="text-xs text-slate-500">
            {active.length} / {maxTeamSize} spelers
          </p>
        </div>
        {isComplete ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            ✓ Ploeg Compleet
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            Nog {maxTeamSize - active.length} nodig
          </span>
        )}
      </div>

      {/* Active Lineup */}
      <ul className="mb-3 space-y-1.5">
        {active.map((member, idx) => {
          const overallIndex = idx;
          const isBeingDragged = draggedIndex === overallIndex;
          const isTarget = dragOverIndex === overallIndex;
          const canRemoveGuest =
            member.isGuest &&
            (isAdmin ||
              (!isLocked && Boolean(currentMemberId && member.invitedById === currentMemberId)));

          return (
            <li
              key={member.id}
              data-roster-index={overallIndex}
              draggable={isAdmin}
              onDragStart={(e) => handleDragStart(e, overallIndex)}
              onDragOver={(e) => handleDragOver(e, overallIndex)}
              onDrop={(e) => handleDrop(e, overallIndex)}
              className={`flex items-center justify-between rounded-xl px-2 py-1.5 text-sm transition-all ${
                isBeingDragged
                  ? "bg-slate-100 opacity-40"
                  : isTarget
                    ? "border border-blue-300 bg-blue-50"
                    : "hover:bg-slate-50"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                {isAdmin && (
                  <div
                    onTouchStart={() => handleTouchStart(overallIndex)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className="-ml-1 shrink-0 cursor-grab touch-none p-1 text-slate-400 hover:text-slate-600 active:cursor-grabbing"
                    title="Sleep om volgorde te wijzigen"
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>
                )}
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  {idx + 1}
                </span>
                <span className="truncate font-medium text-slate-800">{member.name}</span>
                {member.isGuest && (
                  <span className="shrink-0 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    {member.invitedByName ? `Gast van ${member.invitedByName}` : "Gast"}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-slate-400">Speler</span>
                {member.isGuest
                  ? canRemoveGuest && (
                      <button
                        type="button"
                        onClick={() => onRemoveGuest?.(member.rsvpId || member.id)}
                        className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-100 hover:text-red-700"
                      >
                        Verwijderen
                      </button>
                    )
                  : isAdmin &&
                    onAdminOverrideDecline && (
                      <button
                        type="button"
                        onClick={() => onAdminOverrideDecline(member.memberId || member.id)}
                        className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-100 hover:text-red-700"
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
            className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-400 italic"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-400">
              {active.length + idx + 1}
            </span>
            <span>Open plaats...</span>
          </li>
        ))}
      </ul>

      {/* Reserve List */}
      {reserves.length > 0 && (
        <div className="mt-3 border-t border-dashed border-slate-200 pt-3">
          <h4 className="mb-2 text-xs font-bold text-slate-600">
            Reservelijst ({reserves.length})
          </h4>
          <ul className="space-y-1.5">
            {reserves.map((member, idx) => {
              const overallIndex = active.length + idx;
              const isBeingDragged = draggedIndex === overallIndex;
              const isTarget = dragOverIndex === overallIndex;
              const canRemoveGuest =
                member.isGuest &&
                (isAdmin || (currentMemberId && member.invitedById === currentMemberId));

              return (
                <li
                  key={member.id}
                  data-roster-index={overallIndex}
                  draggable={isAdmin}
                  onDragStart={(e) => handleDragStart(e, overallIndex)}
                  onDragOver={(e) => handleDragOver(e, overallIndex)}
                  onDrop={(e) => handleDrop(e, overallIndex)}
                  className={`flex items-center justify-between rounded-xl border px-2 py-1.5 text-xs transition-all ${
                    isBeingDragged
                      ? "border-amber-300 bg-amber-100/50 opacity-40"
                      : isTarget
                        ? "border-blue-400 bg-blue-50"
                        : "border-amber-200 bg-amber-50/70 text-amber-900"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {isAdmin && (
                      <div
                        onTouchStart={() => handleTouchStart(overallIndex)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        className="-ml-1 shrink-0 cursor-grab touch-none p-1 text-amber-500 hover:text-amber-700 active:cursor-grabbing"
                        title="Sleep om volgorde te wijzigen"
                      >
                        <GripVertical className="h-4 w-4" />
                      </div>
                    )}
                    <span className="truncate font-medium">{member.name}</span>
                    {member.isGuest && (
                      <span className="shrink-0 rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                        {member.invitedByName ? `Gast van ${member.invitedByName}` : "Gast"}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold text-amber-700">{formatReserveBadge(idx)}</span>
                    {member.isGuest
                      ? canRemoveGuest && (
                          <button
                            type="button"
                            onClick={() => onRemoveGuest?.(member.rsvpId || member.id)}
                            className="rounded bg-red-100 px-1 py-0.5 text-[10px] font-semibold text-red-600 hover:text-red-700"
                          >
                            Verwijderen
                          </button>
                        )
                      : isAdmin &&
                        onAdminOverrideDecline && (
                          <button
                            type="button"
                            onClick={() => onAdminOverrideDecline(member.memberId || member.id)}
                            className="rounded bg-red-100 px-1 py-0.5 text-[10px] font-semibold text-red-600 hover:text-red-700"
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
        <div className="mt-3 border-t border-slate-100 pt-3">
          <h4 className="mb-2 text-xs font-bold text-slate-500">
            Afgemeld ({declinedMembers.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {declinedMembers.map((member) => (
              <span
                key={member.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
              >
                <span className="font-bold text-slate-400">✕</span>
                <span className="font-medium">{member.name}</span>
                {isAdmin && onAdminOverrideAttend && (
                  <button
                    type="button"
                    onClick={() => onAdminOverrideAttend(member.memberId || member.id)}
                    className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-200"
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
