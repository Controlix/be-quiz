"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { INITIAL_MOCK_QUIZZES } from "@/lib/mockData";
import { TeamLineup, LineupMember } from "@/components/TeamLineup";
import { RsvpControl } from "@/components/RsvpControl";
import { ActionToolbar } from "@/components/ActionToolbar";
import { ArrowLeft, MapPin, Calendar, Coins, User } from "lucide-react";

export default function QuizDetailPage() {
  const params = useParams();
  const quizId = params.id as string;

  const initialQuiz = INITIAL_MOCK_QUIZZES.find((q) => q.id === quizId) || INITIAL_MOCK_QUIZZES[0];

  const [quiz, setQuiz] = useState(initialQuiz);
  const [currentUserRsvp, setCurrentUserRsvp] = useState<"ATTENDING" | "DECLINED" | null>("ATTENDING");

  // Simulated current attendees list
  const [attendees, setAttendees] = useState<LineupMember[]>([
    { id: "m1", name: "Marc (jij)", queuedSince: new Date(1000) },
    { id: "m2", name: "Sarah", queuedSince: new Date(2000) },
    { id: "m3", name: "Tom", queuedSince: new Date(3000) },
    { id: "m4", name: "Elena", queuedSince: new Date(4000) },
    { id: "m5", name: "Thomas", queuedSince: new Date(5000) },
  ]);

  const handleRsvpChange = (status: "ATTENDING" | "DECLINED") => {
    setCurrentUserRsvp(status);
    if (status === "DECLINED") {
      setAttendees((prev) => prev.filter((a) => a.id !== "m1"));
    } else {
      if (!attendees.some((a) => a.id === "m1")) {
        setAttendees((prev) => [...prev, { id: "m1", name: "Marc (jij)", queuedSince: new Date() }]);
      }
    }
  };

  const handleRegisterToggle = () => {
    setQuiz((prev) => ({
      ...prev,
      team: {
        ...prev.team,
        registeredAt: prev.team.registeredAt ? null : new Date(),
      },
    }));
  };

  const handlePaymentToggle = () => {
    setQuiz((prev) => ({
      ...prev,
      team: {
        ...prev.team,
        paidAt: prev.team.paidAt ? null : new Date(),
        paidByName: prev.team.paidAt ? undefined : "Marc",
      },
    }));
  };

  const currentUserIndex = attendees.findIndex((a) => a.id === "m1");
  const isReserve = currentUserIndex >= quiz.team.maxTeamSize;
  const reservePosition = isReserve ? currentUserIndex - quiz.team.maxTeamSize + 1 : null;

  const dateStr = new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(quiz.startsAt));

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
        <span className="text-xs text-slate-400 font-medium">Quiz Details</span>
      </div>

      {/* Flyer Banner Placeholder */}
      <div className="w-full h-32 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex flex-col items-center justify-center text-white p-4 mb-4 shadow-sm relative overflow-hidden">
        <span className="text-3xl mb-1">🏆</span>
        <h2 className="text-lg font-bold text-center drop-shadow-sm">{quiz.title}</h2>
        <span className="text-xs bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full mt-1">
          {quiz.team.name}
        </span>
      </div>

      {/* Meta Details Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 shadow-sm space-y-2 text-sm text-slate-700">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-medium">{dateStr}</span>
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
      <TeamLineup attendees={attendees} maxTeamSize={quiz.team.maxTeamSize} />

      {/* Actions (Email, Payment, WhatsApp) */}
      <ActionToolbar
        quizTitle={quiz.title}
        quizDate={new Date(quiz.startsAt)}
        organizerEmail="organisatie@quiz.be"
        isRegistered={quiz.team.registeredAt !== null}
        isPaid={quiz.team.paidAt !== null}
        paidByName={quiz.team.paidByName}
        teamName={quiz.team.name}
        onRegisterToggle={handleRegisterToggle}
        onPaymentToggle={handlePaymentToggle}
      />
    </div>
  );
}
