"use client";

import { useState } from "react";
import Link from "next/link";
import { TeamLineup, LineupMember } from "@/components/TeamLineup";
import { RsvpControl } from "@/components/RsvpControl";
import { ActionToolbar } from "@/components/ActionToolbar";
import { joinQuizRsvpAction, declineQuizRsvpAction } from "@/actions/rsvpActions";
import { adminOverrideDeclineAction } from "@/actions/adminActions";
import { adminReorderRsvpAction } from "@/actions/reorderActions";
import { setRegisteredAction, toggleFeePaidAction } from "@/actions/registrationActions";
import { formatEuropeanDateTime } from "@/lib/formatters";
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
  const initialAttendees: LineupMember[] = (team?.rsvps || [])
    .filter((r: any) => r.status === "ATTENDING")
    .map((r: any) => ({
      id: r.memberId,
      name: r.member?.name || "Lid",
      queuedSince: new Date(r.queuedSince || r.createdAt),
    }));

  const userRsvp = (team?.rsvps || []).find((r: any) => r.memberId === currentMemberId);
  const initialStatus = userRsvp?.status || null;

  const [attendees, setAttendees] = useState<LineupMember[]>(initialAttendees);
  const [currentUserRsvp, setCurrentUserRsvp] = useState<"ATTENDING" | "DECLINED" | null>(
    initialStatus
  );
  const [isRegistered, setIsRegistered] = useState(team?.registeredAt !== null);
  const [isPaid, setIsPaid] = useState(team?.paidAt !== null);

  const handleRsvpChange = async (status: "ATTENDING" | "DECLINED") => {
    setCurrentUserRsvp(status);
    if (status === "ATTENDING") {
      if (!attendees.some((a) => a.id === currentMemberId)) {
        setAttendees((prev) => [
          ...prev,
          { id: currentMemberId, name: `${currentMemberName} (jij)`, queuedSince: new Date() },
        ]);
      }
      await joinQuizRsvpAction(team.id, currentMemberId);
    } else {
      setAttendees((prev) => prev.filter((a) => a.id !== currentMemberId));
      await declineQuizRsvpAction(team.id, currentMemberId);
    }
  };

  const handleAdminOverrideDecline = async (memberId: string) => {
    if (window.confirm("Ben je zeker dat je deze speler namens hen wilt afzeggen?")) {
      setAttendees((prev) => prev.filter((a) => a.id !== memberId));
      await adminOverrideDeclineAction(team.id, memberId, currentMemberId);
    }
  };

  const handleReorder = async (sourceIndex: number, destinationIndex: number) => {
    setAttendees((prev) => {
      const sorted = [...prev].sort(
        (a, b) => new Date(a.queuedSince).getTime() - new Date(b.queuedSince).getTime()
      );
      const [moved] = sorted.splice(sourceIndex, 1);
      sorted.splice(destinationIndex, 0, moved);
      const baseTime = Date.now() - 100000;
      return sorted.map((item, idx) => ({
        ...item,
        queuedSince: new Date(baseTime + idx * 1000),
      }));
    });

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
    <div className="flex-1 flex flex-col p-4 pb-20">
      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-4 pt-1">
        <Link
          href="/quizzes"
          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 text-sm font-semibold p-1 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Overzicht</span>
        </Link>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href={`/quizzes/${quiz.id}/edit`}
              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg font-medium"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Admin</span>
            </Link>
          )}
          <span className="text-xs text-slate-400 font-medium">Quiz Details</span>
        </div>
      </div>

      {/* Flyer Banner / Poster */}
      {quiz.flyerImageUrl ? (
        <div className="w-full rounded-2xl overflow-hidden mb-4 border border-slate-200 shadow-sm bg-slate-900 relative">
          <img
            src={quiz.flyerImageUrl}
            alt={`Flyer voor ${quiz.title}`}
            className="w-full max-h-64 object-cover object-top"
          />
          <div className="p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent absolute bottom-0 left-0 right-0 text-white">
            <h2 className="text-base font-bold drop-shadow-sm">{quiz.title}</h2>
            <span className="text-[11px] bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-full mt-0.5 inline-block">
              {team?.name || "De Quizvrienden"}
            </span>
          </div>
        </div>
      ) : (
        <div className="w-full h-32 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex flex-col items-center justify-center text-white p-4 mb-4 shadow-sm relative overflow-hidden">
          <span className="text-3xl mb-1">🏆</span>
          <h2 className="text-lg font-bold text-center drop-shadow-sm">{quiz.title}</h2>
          <span className="text-xs bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full mt-1">
            {team?.name || "De Quizvrienden"}
          </span>
        </div>
      )}

      {/* Meta Details Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 shadow-sm space-y-2 text-sm text-slate-700">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
          <span suppressHydrationWarning className="font-medium">{dateStr}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{quiz.location}</span>
        </div>
        {quiz.entryFee && (
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-600 shrink-0" />
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
        maxTeamSize={team?.maxTeamSize || 4}
        isAdmin={isAdmin}
        onAdminOverrideDecline={handleAdminOverrideDecline}
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
    </div>
  );
}
