"use client";

import { useState, useReducer } from "react";
import Image from "next/image";
import Link from "next/link";
import { TeamLineup } from "@/components/TeamLineup";
import { RsvpControl } from "@/components/RsvpControl";
import { ActionToolbar } from "@/components/ActionToolbar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AlertDialog } from "@/components/AlertDialog";
import { AddGuestDialog } from "@/components/AddGuestDialog";
import { EnrollMemberDialog } from "@/components/EnrollMemberDialog";
import { EditQuizDialog } from "@/components/EditQuizDialog";
import { joinQuizRsvpAction, declineQuizRsvpAction } from "@/actions/rsvpActions";
import { adminOverrideDeclineAction, adminOverrideAttendAction } from "@/actions/adminActions";
import { adminReorderRsvpAction } from "@/actions/reorderActions";
import { setRegisteredAction, toggleFeePaidAction } from "@/actions/registrationActions";
import { addGuestAction, removeGuestAction } from "@/actions/guestActions";
import { updateQuizDetailsAction, UpdateQuizMetadataInput } from "@/actions/quizActions";
import { formatEuropeanDateTime } from "@/lib/formatters";
import {
  rsvpReducer,
  deriveCurrentUserStatus,
  deriveLineupRosters,
  deriveUnrespondedMembers,
  ClientRsvp,
} from "@/lib/rsvpReducer";
import { isQuizConcluded, QuizRatingSummary } from "@/lib/ratingRules";
import { isPersonalRsvpLocked, isQuizLockedForUser } from "@/lib/quizLock";
import { QuizRatingWidget } from "@/components/QuizRatingWidget";
import { ArrowLeft, MapPin, Calendar, Coins, Settings, UserPlus, Pencil } from "lucide-react";

interface QuizDetailClientProps {
  quiz: any;
  currentMemberId: string;
  currentMemberName?: string;
  isAdmin?: boolean;
  initialRatingSummary?: QuizRatingSummary;
  allMembers?: Array<{ id: string; name: string }>;
}

export function QuizDetailClient({
  quiz,
  currentMemberId,
  currentMemberName = "Lid",
  isAdmin = false,
  initialRatingSummary,
  allMembers = [],
}: QuizDetailClientProps) {
  const team = quiz.team;
  const initialRsvps: ClientRsvp[] = (team?.rsvps || []).map((r: any) => ({
    id: r.id,
    memberId: r.memberId ?? null,
    guestName: r.guestName ?? null,
    invitedById: r.invitedById ?? null,
    invitedByName: r.invitedBy?.name ?? null,
    isGuest: Boolean(r.guestName || r.invitedById),
    name: r.member?.name || r.guestName || "Lid",
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
  const enrollableMembers = deriveUnrespondedMembers(allMembers, rsvps, currentMemberId);

  const [quizDetails, setQuizDetails] = useState({
    id: quiz.id as string,
    title: quiz.title as string,
    startsAt: quiz.startsAt as Date | string,
    location: quiz.location as string,
    organizerEmail: (quiz.organizerEmail ?? null) as string | null,
    entryFee: (quiz.entryFee ?? null) as string | null,
    flyerImageUrl: (quiz.flyerImageUrl ?? null) as string | null,
    status: (quiz.status ?? "OPEN") as "OPEN" | "CANCELLED" | "ARCHIVED",
    durationMinutes: (quiz.durationMinutes ?? 180) as number,
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [isRegistered, setIsRegistered] = useState(team?.registeredAt !== null);
  const [isPaid, setIsPaid] = useState(team?.paidAt !== null);
  const [selectedMemberToDecline, setSelectedMemberToDecline] = useState<string | null>(null);
  const [ratingSummary, setRatingSummary] = useState<QuizRatingSummary | undefined>(
    initialRatingSummary
  );
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false);
  const [isAddingGuest, setIsAddingGuest] = useState(false);
  const [isEnrollMemberOpen, setIsEnrollMemberOpen] = useState(false);
  const [isEnrollingMember, setIsEnrollingMember] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSaveQuizDetails = async (payload: UpdateQuizMetadataInput) => {
    const res = await updateQuizDetailsAction(quizDetails.id, payload);
    if (!res.success) {
      throw new Error(res.error);
    }
    setQuizDetails((prev) => ({
      ...prev,
      ...res.quiz,
    }));
  };

  const handleRsvpChange = async (status: "ATTENDING" | "DECLINED") => {
    try {
      const res =
        status === "ATTENDING"
          ? await joinQuizRsvpAction(team.id, currentMemberId, quiz.id)
          : await declineQuizRsvpAction(team.id, currentMemberId, quiz.id);

      if (!res.success) {
        setErrorMessage(res.error || "Fout bij bijwerken van deelname");
        return;
      }

      dispatchRsvp({
        type: "USER_RSVP",
        memberId: currentMemberId,
        name: currentMemberName,
        status,
      });

      if (res.ratingSummary) {
        setRatingSummary(res.ratingSummary);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Fout bij bijwerken van deelname");
    }
  };

  const handleAddGuest = async (guestName: string) => {
    setIsAddingGuest(true);
    try {
      const res = await addGuestAction(team.id, guestName);
      if (!res.success) {
        throw new Error(res.error);
      }
      dispatchRsvp({
        type: "ADD_GUEST",
        id: res.rsvp.id,
        guestName: res.rsvp.guestName,
        invitedById: res.rsvp.invitedById,
        invitedByName: res.rsvp.invitedByName,
      });
    } finally {
      setIsAddingGuest(false);
    }
  };

  const handleRemoveGuest = async (rsvpId: string) => {
    try {
      const res = await removeGuestAction(rsvpId, team.id);
      if (!res.success) {
        setErrorMessage(res.error);
        return;
      }
      dispatchRsvp({ type: "REMOVE_GUEST", id: rsvpId });
    } catch (err: any) {
      setErrorMessage(err.message || "Fout bij verwijderen van gast");
    }
  };

  const handleAdminOverrideDecline = (memberId: string) => {
    setSelectedMemberToDecline(memberId);
  };

  const confirmAdminOverrideDecline = async () => {
    if (!selectedMemberToDecline) return;
    const memberId = selectedMemberToDecline;
    setSelectedMemberToDecline(null);

    try {
      const res = await adminOverrideDeclineAction(team.id, memberId, currentMemberId);
      if (!res.success) {
        setErrorMessage(res.error || "Fout bij afzeggen van speler");
        return;
      }
      dispatchRsvp({ type: "ADMIN_OVERRIDE_DECLINE", memberId });
    } catch (err: any) {
      setErrorMessage(err?.message || "Fout bij afzeggen van speler");
    }
  };

  const handleAdminOverrideAttend = async (memberId: string) => {
    try {
      const res = await adminOverrideAttendAction(team.id, memberId, currentMemberId);
      if (!res.success) {
        setErrorMessage(res.error || "Fout bij aanmelden van speler");
        return;
      }
      dispatchRsvp({ type: "ADMIN_OVERRIDE_ATTEND", memberId });
    } catch (err: any) {
      setErrorMessage(err?.message || "Fout bij aanmelden van speler");
    }
  };

  const handleEnrollMember = async (memberId: string, memberName: string) => {
    setIsEnrollingMember(true);
    try {
      const res = await adminOverrideAttendAction(team.id, memberId, currentMemberId);
      if (!res.success) {
        throw new Error(res.error || "Fout bij aanmelden van teamlid");
      }
      dispatchRsvp({ type: "ADMIN_OVERRIDE_ATTEND", memberId, name: memberName });
    } finally {
      setIsEnrollingMember(false);
    }
  };

  const handleReorder = async (sourceIndex: number, destinationIndex: number) => {
    try {
      const res = await adminReorderRsvpAction(team.id, sourceIndex, destinationIndex);
      if (!res.success) {
        setErrorMessage(res.error || "Fout bij herordenen van opstelling");
        return;
      }
      dispatchRsvp({ type: "ADMIN_REORDER", sourceIndex, destinationIndex });
    } catch (err: any) {
      setErrorMessage(err?.message || "Fout bij herordenen van opstelling");
    }
  };

  const handleRegisterToggle = async () => {
    try {
      const res = await setRegisteredAction(team.id, currentMemberId);
      if (!res.success) {
        setErrorMessage(res.error || "Fout bij bijwerken van inschrijving");
        return;
      }
      setIsRegistered((prev) => !prev);
    } catch (err: any) {
      setErrorMessage(err?.message || "Fout bij bijwerken van inschrijving");
    }
  };

  const handlePaymentToggle = async () => {
    try {
      const res = await toggleFeePaidAction(team.id, currentMemberId);
      if (!res.success) {
        setErrorMessage(res.error || "Fout bij bijwerken van betaalstatus");
        return;
      }
      setIsPaid(typeof res.isPaid === "boolean" ? res.isPaid : !isPaid);
    } catch (err: any) {
      setErrorMessage(err?.message || "Fout bij bijwerken van betaalstatus");
    }
  };

  const currentUserIndex = attendees.findIndex((a) => a.memberId === currentMemberId);
  const isReserve = currentUserIndex >= (team?.maxTeamSize || 4);
  const reservePosition = isReserve ? currentUserIndex - (team?.maxTeamSize || 4) + 1 : null;
  const isEligible = currentUserIndex !== -1 && !isReserve;
  const isConcluded = isQuizConcluded(new Date(quizDetails.startsAt), quizDetails.durationMinutes);
  const isPersonalLocked = isPersonalRsvpLocked(quizDetails);
  const isLockedForUser = isQuizLockedForUser(quizDetails, isAdmin ? "ADMIN" : "USER");

  const dateStr = formatEuropeanDateTime(quizDetails.startsAt);

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
          {!isLockedForUser && (
            <button
              type="button"
              onClick={() => setIsEditDialogOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 hover:text-slate-900"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Bewerken</span>
            </button>
          )}
          {isAdmin && (
            <Link
              href={`/quizzes/${quizDetails.id}/edit`}
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
      {quizDetails.flyerImageUrl ? (
        <div className="relative mb-4 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm">
          <Image
            src={quizDetails.flyerImageUrl}
            alt={`Flyer voor ${quizDetails.title}`}
            width={800}
            height={400}
            unoptimized
            className="max-h-64 w-full object-cover object-top"
          />
          <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 text-white">
            <h2 className="text-base font-bold drop-shadow-sm">{quizDetails.title}</h2>
            <span className="mt-0.5 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[11px] backdrop-blur-xs">
              {team?.name || "De Quizvrienden"}
            </span>
          </div>
        </div>
      ) : (
        <div className="relative mb-4 flex h-32 w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white shadow-sm">
          <span className="mb-1 text-3xl">🏆</span>
          <h2 className="text-center text-lg font-bold drop-shadow-sm">{quizDetails.title}</h2>
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
          <span>{quizDetails.location}</span>
        </div>
        {quizDetails.entryFee && (
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Inschrijvingsgeld: {quizDetails.entryFee}</span>
          </div>
        )}
      </div>

      {/* Quiz Rating Widget (Concluded Quizzes) */}
      {ratingSummary && (
        <QuizRatingWidget
          quizId={quizDetails.id}
          summary={ratingSummary}
          isConcluded={isConcluded}
          isEligible={isEligible}
          isCancelled={quizDetails.status === "CANCELLED"}
          onRatingChange={setRatingSummary}
        />
      )}

      {/* Interactive RSVP Control */}
      <RsvpControl
        currentStatus={currentUserRsvp}
        onRsvpChange={handleRsvpChange}
        reservePosition={reservePosition}
        isLocked={isPersonalLocked}
        isAdmin={isAdmin}
      />

      {/* Guest & Admin Member Addition */}
      {!isLockedForUser && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddGuestOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900"
          >
            <UserPlus className="h-3.5 w-3.5 text-blue-600" />
            <span>+ Gast toevoegen</span>
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsEnrollMemberOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900"
            >
              <UserPlus className="h-3.5 w-3.5 text-blue-600" />
              <span>+ Teamlid toevoegen</span>
            </button>
          )}
        </div>
      )}

      {/* Lineup & Reserve List */}
      <TeamLineup
        attendees={attendees}
        declinedMembers={declinedMembers}
        maxTeamSize={team?.maxTeamSize || 4}
        isAdmin={isAdmin}
        isLocked={isLockedForUser}
        currentMemberId={currentMemberId}
        onAdminOverrideDecline={handleAdminOverrideDecline}
        onAdminOverrideAttend={handleAdminOverrideAttend}
        onRemoveGuest={handleRemoveGuest}
        onReorder={handleReorder}
      />

      {/* Actions (Email, Payment, WhatsApp) */}
      <ActionToolbar
        quizId={quizDetails.id}
        quizTitle={quizDetails.title}
        quizDate={new Date(quizDetails.startsAt)}
        location={quizDetails.location}
        durationMinutes={quizDetails.durationMinutes}
        organizerEmail={quizDetails.organizerEmail || undefined}
        isRegistered={isRegistered}
        isPaid={isPaid}
        paidByName={team?.paidBy?.name}
        teamName={team?.name || "De Quizvrienden"}
        contactName={currentMemberName}
        isLocked={isLockedForUser}
        onRegisterToggle={handleRegisterToggle}
        onPaymentToggle={handlePaymentToggle}
      />

      <EditQuizDialog
        isOpen={isEditDialogOpen}
        quiz={quizDetails}
        onClose={() => setIsEditDialogOpen(false)}
        onSave={handleSaveQuizDetails}
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

      <AddGuestDialog
        isOpen={isAddGuestOpen}
        onClose={() => setIsAddGuestOpen(false)}
        onAddGuest={handleAddGuest}
        isSubmitting={isAddingGuest}
      />

      <EnrollMemberDialog
        isOpen={isEnrollMemberOpen}
        onClose={() => setIsEnrollMemberOpen(false)}
        availableMembers={enrollableMembers}
        onEnroll={handleEnrollMember}
        isSubmitting={isEnrollingMember}
      />

      <AlertDialog
        isOpen={errorMessage !== null}
        title="Fout"
        message={errorMessage || ""}
        variant="error"
        actionLabel="Sluiten"
        onClose={() => setErrorMessage(null)}
      />
    </div>
  );
}
