"use client";

import { useState } from "react";
import Link from "next/link";
import { TimelineTabs, TabCategory, categorizeQuizForTabs } from "@/components/TimelineTabs";
import { QuizCard } from "@/components/QuizCard";
import { Plus, Trophy, LogOut } from "lucide-react";

interface QuizzesDashboardProps {
  initialQuizzes: any[];
}

export function QuizzesDashboard({ initialQuizzes }: QuizzesDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabCategory>("IN_BERAAD");

  const counts: Record<TabCategory, number> = {
    IN_BERAAD: initialQuizzes.filter((q) => categorizeQuizForTabs(q) === "IN_BERAAD").length,
    GEPLAND: initialQuizzes.filter((q) => categorizeQuizForTabs(q) === "GEPLAND").length,
    ARCHIEF: initialQuizzes.filter((q) => categorizeQuizForTabs(q) === "ARCHIEF").length,
  };

  const filteredQuizzes = initialQuizzes.filter(
    (q) => categorizeQuizForTabs(q) === activeTab
  );

  return (
    <div className="flex-1 flex flex-col p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-none">KwisVrienden</h1>
            <p className="text-xs text-slate-500 mt-0.5">Jullie kwisagenda</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/quizzes/new"
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nieuwe Quiz</span>
          </Link>

          <a
            href="/auth/logout"
            title="Afmelden"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Tabs */}
      <TimelineTabs activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />

      {/* List */}
      <div className="flex-1">
        {filteredQuizzes.length > 0 ? (
          filteredQuizzes.map((quiz) => (
            <QuizCard
              key={quiz.id}
              quiz={{
                id: quiz.id,
                title: quiz.title,
                startsAt: new Date(quiz.startsAt),
                location: quiz.location,
                entryFee: quiz.entryFee || undefined,
                status: quiz.status,
                team: {
                  name: quiz.team?.name || "De Quizvrienden",
                  maxTeamSize: quiz.team?.maxTeamSize || 4,
                  registeredAt: quiz.team?.registeredAt ? new Date(quiz.team.registeredAt) : null,
                  paidAt: quiz.team?.paidAt ? new Date(quiz.team.paidAt) : null,
                  paidByName: quiz.team?.paidBy?.name,
                  rsvps: (quiz.team?.rsvps || []).map((r: any) => ({
                    id: r.id,
                    memberName: r.member?.name || "Lid",
                    status: r.status,
                  })),
                },
              }}
            />
          ))
        ) : (
          <div className="text-center py-12 px-4 text-slate-400">
            <p className="text-sm">Geen quizzen gevonden in deze categorie.</p>
          </div>
        )}
      </div>
    </div>
  );
}
