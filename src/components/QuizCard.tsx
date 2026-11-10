import Link from "next/link";
import { MockQuiz } from "@/lib/mockData";
import { formatEuropeanDateTime } from "@/lib/formatters";
import { Calendar, MapPin, Users, CheckCircle, Clock, AlertTriangle } from "lucide-react";

interface QuizCardProps {
  quiz: MockQuiz;
  rating?: { average: number; count: number } | null;
}

export function QuizCard({ quiz, rating }: QuizCardProps) {
  const attendingCount = quiz.team.rsvps.filter((r) => r.status === "ATTENDING").length;
  const isFull = attendingCount >= quiz.team.maxTeamSize;
  const isRegistered = quiz.team.registeredAt !== null;
  const isCancelled = quiz.status === "CANCELLED";

  const dateStr = formatEuropeanDateTime(quiz.startsAt);

  return (
    <Link href={`/quizzes/${quiz.id}`} className="block">
      <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md active:scale-[0.99]">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base leading-snug font-bold text-slate-900">{quiz.title}</h3>
            {rating && rating.count > 0 && !isCancelled && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                ★ {rating.average.toFixed(1)}
              </span>
            )}
          </div>
          {isCancelled ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              <AlertTriangle className="h-3 w-3" /> Geannuleerd
            </span>
          ) : isRegistered ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              <CheckCircle className="h-3 w-3" /> Ingeschreven
            </span>
          ) : isFull ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              <Users className="h-3 w-3" /> Ploeg vol
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              <Clock className="h-3 w-3" /> Nog {quiz.team.maxTeamSize - attendingCount} nodig
            </span>
          )}
        </div>

        <div className="mb-3 space-y-1 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span suppressHydrationWarning>{dateStr}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{quiz.location}</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
          <div className="flex items-center gap-1 font-medium text-slate-700">
            <span>
              👥 {attendingCount} / {quiz.team.maxTeamSize}
            </span>
            {attendingCount > quiz.team.maxTeamSize && (
              <span className="font-semibold text-amber-600">
                (+{attendingCount - quiz.team.maxTeamSize} reserve)
              </span>
            )}
          </div>
          <div>
            {quiz.team.paidAt ? (
              <span className="font-medium text-emerald-600">
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
