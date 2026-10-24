import Link from "next/link";
import { MockQuiz } from "@/lib/mockData";
import { formatEuropeanDateTime } from "@/lib/formatters";
import { Calendar, MapPin, Users, CheckCircle, Clock, AlertTriangle } from "lucide-react";

interface QuizCardProps {
  quiz: MockQuiz;
}

export function QuizCard({ quiz }: QuizCardProps) {
  const attendingCount = quiz.team.rsvps.filter((r) => r.status === "ATTENDING").length;
  const isFull = attendingCount >= quiz.team.maxTeamSize;
  const isRegistered = quiz.team.registeredAt !== null;
  const isCancelled = quiz.status === "CANCELLED";

  const dateStr = formatEuropeanDateTime(quiz.startsAt);

  return (
    <Link href={`/quizzes/${quiz.id}`} className="block">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3 shadow-sm hover:shadow-md transition-shadow active:scale-[0.99]">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-slate-900 text-base leading-snug">{quiz.title}</h3>
          {isCancelled ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold shrink-0">
              <AlertTriangle className="w-3 h-3" /> Geannuleerd
            </span>
          ) : isRegistered ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold shrink-0">
              <CheckCircle className="w-3 h-3" /> Ingeschreven
            </span>
          ) : isFull ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold shrink-0">
              <Users className="w-3 h-3" /> Ploeg vol
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold shrink-0">
              <Clock className="w-3 h-3" /> Nog {quiz.team.maxTeamSize - attendingCount} nodig
            </span>
          )}
        </div>

        <div className="space-y-1 text-xs text-slate-600 mb-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span suppressHydrationWarning>{dateStr}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{quiz.location}</span>
          </div>
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-slate-700 font-medium">
            <span>👥 {attendingCount} / {quiz.team.maxTeamSize}</span>
            {attendingCount > quiz.team.maxTeamSize && (
              <span className="text-amber-600 font-semibold">
                (+{attendingCount - quiz.team.maxTeamSize} reserve)
              </span>
            )}
          </div>
          <div>
            {quiz.team.paidAt ? (
              <span className="text-emerald-600 font-medium">
                ✓ Betaald {quiz.team.paidByName ? `(${quiz.team.paidByName})` : ""}
              </span>
            ) : (
              <span className="text-slate-400">Nog niet betaald</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
