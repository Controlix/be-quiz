"use client";

import { useState, useReducer } from "react";
import Image from "next/image";
import Link from "next/link";
import { TeamLineup } from "@/components/TeamLineup";
import { RsvpControl } from "@/components/RsvpControl";
import { ActionToolbar } from "@/components/ActionToolbar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { joinQuizRsvpAction, declineQuizRsvpAction } from "@/actions/rsvpActions";
import { adminOverrideDeclineAction, adminOverrideAttendAction } from "@/actions/adminActions";
import { adminReorderRsvpAction } from "@/actions/reorderActions";
import { setRegisteredAction, toggleFeePaidAction } from "@/actions/registrationActions";
import { formatEuropeanDateTime } from "@/lib/formatters";
import {
  rsvpReducer,
  deriveCurrentUserStatus,
  deriveLineupRosters,
  ClientRsvp,
} from "@/lib/rsvpReducer";
import { ArrowLeft, MapPin, Calendar, Coins, Settings } from "lucide-react";

interface QuizDetailClientProps {
  quiz: any;
  currentMemberId: string;
  currentMemberName?: string;
  isAdmin?: boolean;
}

export function QuizDetailClient({
  quiz,
  currentMemberId,
  currentMemberName = "Lid",
  isAdmin = false,
}: QuizDetailClientProps) {
  const team = quiz.team;
  const initialRsvps: ClientRsvp[] = (team?.rsvps || []).map((r: any) => ({
    memberId: r.memberId,
    name: r.member?.name || "Lid",
    status: r.status as "ATTENDING" | "DECLINED",
    queuedSince: r.queuedSince
      ? new Date(r.queuedSince)
      : r.createdAt
        ? new Date(r.createdAt)
        : null,
  }));

  const [rsvps, dispatchRsvp] = useReducer(rsvpReducer, initialRsvps);

  const currentUserRsvp = deriveCurrentUserStatus(rsvps, currentMemberId);
  const { attendees, declined: declinedMembers } = deriveLineupRosters(rsvps, currentMemberId);

  const [isRegistered, setIsRegistered] = useState(team?.registeredAt !== null);
  const [isPaid, setIsPaid] = useState(team?.paidAt !== null);
  const [selectedMemberToDecline, setSelectedMemberToDecline] = useState<string | null>(null);

  const handleRsvpChange = async (status: "ATTENDING" | "DECLINED") => {
    dispatchRsvp({
      type: "USER_RSVP",
      memberId: currentMemberId,
      name: currentMemberName,
      status,
    });
    if (status === "ATTENDING") {
      await joinQuizRsvpAction(team.id, currentMemberId);
    } else {
      await declineQuizRsvpAction(team.id, currentMemberId);
    }
  };

  const handleAdminOverrideDecline = (memberId: string) => {
    setSelectedMemberToDecline(memberId);
  };

  const confirmAdminOverrideDecline = async () => {
    if (!selectedMemberToDecline) return;
    const memberId = selectedMemberToDecline;
    setSelectedMemberToDecline(null);

    dispatchRsvp({ type: "ADMIN_OVERRIDE_DECLINE", memberId });
    await adminOverrideDeclineAction(team.id, memberId, currentMemberId);
  };

  const handleAdminOverrideAttend = async (memberId: string) => {
    dispatchRsvp({ type: "ADMIN_OVERRIDE_ATTEND", memberId });
    await adminOverrideAttendAction(team.id, memberId, currentMemberId);
  };

  const handleReorder = async (sourceIndex: number, destinationIndex: number) => {
    dispatchRsvp({ type: "ADMIN_REORDER", sourceIndex, destinationIndex });
    await adminReorderRsvpAction(team.id, sourceIndex, destinationIndex);
  };

  const handleRegisterToggle = async () => {
    setIsRegistered((prev) => !prev);
    await setRegisteredAction(team.id, currentMemberId);
  };

  const handlePaymentToggle = async () => {
    setIsPaid((prev) => !prev);
    await toggleFeePaidAction(team.id, currentMemberId);
  };

  const currentUserIndex = attendees.findIndex((a) => a.id === currentMemberId);
  const isReserve = currentUserIndex >= (team?.maxTeamSize || 4);
  const reservePosition = isReserve ? currentUserIndex - (team?.maxTeamSize || 4) + 1 : null;

  const dateStr = formatEuropeanDateTime(quiz.startsAt);

  return (
    <div className="flex flex-1 flex-col p-4 pb-20">
      {/* Top Navigation */}
      <div className="mb-4 flex items-center justify-between pt-1">
        <Link
          href="/quizzes"
          className="-ml-1 inline-flex items-center gap-1 rounded-lg p-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Overzicht</span>
        </Link>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href={`/quizzes/${quiz.id}/edit`}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Admin</span>
            </Link>
          )}
          <span className="text-xs font-medium text-slate-400">Quiz Details</span>
        </div>
      </div>

      {/* Flyer Banner / Poster */}
      {quiz.flyerImageUrl ? (
        <div className="relative mb-4 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm">
          <Image
            src={quiz.flyerImageUrl}
            alt={`Flyer voor ${quiz.title}`}
            width={800}
            height={400}
            unoptimized
            className="max-h-64 w-full object-cover object-top"
          />
          <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 text-white">
            <h2 className="text-base font-bold drop-shadow-sm">{quiz.title}</h2>
            <span className="mt-0.5 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[11px] backdrop-blur-xs">
              {team?.name || "De Quizvrienden"}
            </span>
          </div>
        </div>
      ) : (
        <div className="relative mb-4 flex h-32 w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white shadow-sm">
          <span className="mb-1 text-3xl">🏆</span>
          <h2 className="text-center text-lg font-bold drop-shadow-sm">{quiz.title}</h2>
          <span className="mt-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs backdrop-blur-xs">
            {team?.name || "De Quizvrienden"}
          </span>
        </div>
      )}

      {/* Meta Details Card */}
      <div className="mb-4 space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-blue-600" />
          <span suppressHydrationWarning className="font-medium">
            {dateStr}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-blue-600" />
          <span>{quiz.location}</span>
        </div>
        {quiz.entryFee && (
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Inschrijvingsgeld: {quiz.entryFee}</span>
          </div>
        )}
      </div>

      {/* Interactive RSVP Control */}
      <RsvpControl
        currentStatus={currentUserRsvp}
        onRsvpChange={handleRsvpChange}
        reservePosition={reservePosition}
      />

      {/* Lineup & Reserve List */}
      <TeamLineup
        attendees={attendees}
        declinedMembers={declinedMembers}
        maxTeamSize={team?.maxTeamSize || 4}
        isAdmin={isAdmin}
        onAdminOverrideDecline={handleAdminOverrideDecline}
        onAdminOverrideAttend={handleAdminOverrideAttend}
        onReorder={handleReorder}
      />

      {/* Actions (Email, Payment, WhatsApp) */}
      <ActionToolbar
        quizId={quiz.id}
        quizTitle={quiz.title}
        quizDate={new Date(quiz.startsAt)}
        location={quiz.location}
        durationMinutes={quiz.durationMinutes || 180}
        organizerEmail={quiz.organizerEmail || undefined}
        isRegistered={isRegistered}
        isPaid={isPaid}
        paidByName={team?.paidBy?.name}
        teamName={team?.name || "De Quizvrienden"}
        contactName={currentMemberName}
        onRegisterToggle={handleRegisterToggle}
        onPaymentToggle={handlePaymentToggle}
      />

      <ConfirmDialog
        isOpen={selectedMemberToDecline !== null}
        title="Speler Afzeggen?"
        message="Ben je zeker dat je deze speler namens hen wilt afzeggen?"
        confirmLabel="Ja, Afzeggen"
        isDestructive={true}
        onConfirm={confirmAdminOverrideDecline}
        onCancel={() => setSelectedMemberToDecline(null)}
      />
    </div>
  );
}
