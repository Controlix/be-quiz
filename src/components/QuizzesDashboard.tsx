"use client";

import { useState } from "react";
import Link from "next/link";
import { TimelineTabs, TabCategory, categorizeQuizForTabs } from "@/components/TimelineTabs";
import { QuizCard } from "@/components/QuizCard";
import { Plus, Trophy, LogOut, Shield } from "lucide-react";

interface QuizzesDashboardProps {
  initialQuizzes: any[];
  isAdmin?: boolean;
}

export function QuizzesDashboard({ initialQuizzes, isAdmin = false }: QuizzesDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabCategory>("IN_BERAAD");

  const counts: Record<TabCategory, number> = {
    IN_BERAAD: initialQuizzes.filter((q) => categorizeQuizForTabs(q) === "IN_BERAAD").length,
    GEPLAND: initialQuizzes.filter((q) => categorizeQuizForTabs(q) === "GEPLAND").length,
    ARCHIEF: initialQuizzes.filter((q) => categorizeQuizForTabs(q) === "ARCHIEF").length,
  };

  const filteredQuizzes = initialQuizzes.filter((q) => categorizeQuizForTabs(q) === activeTab);

  return (
    <div className="flex flex-1 flex-col p-4 pb-20">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg leading-none font-bold text-slate-900">KwisVrienden</h1>
            <p className="mt-0.5 text-xs text-slate-500">Jullie kwisagenda</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href="/admin"
              title="Admin Beheer"
              className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
            >
              <Shield className="h-3.5 w-3.5 text-blue-600" />
              <span>Beheer</span>
            </Link>
          )}

          <Link
            href="/quizzes/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nieuwe Quiz</span>
          </Link>

          <a
            href="/auth/logout"
            title="Afmelden"
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <LogOut className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Tabs */}
      <TimelineTabs activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />

      {/* List */}
      <div className="flex-1">
        {initialQuizzes.length === 0 ? (
          <div className="my-4 space-y-4 rounded-3xl border border-slate-200 bg-white px-4 py-16 text-center shadow-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600">
              🏆
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Nog geen quizzen gepland</h3>
              <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">
                Nog geen quizzen gepland. Tik op &apos;+ Nieuwe Quiz&apos; om de eerste quiz toe te
                voegen!
              </p>
            </div>
            <Link
              href="/quizzes/new"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Eerste Quiz Toevoegen</span>
            </Link>
          </div>
        ) : filteredQuizzes.length > 0 ? (
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
                  name: quiz.team?.name || "Ben in Black",
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
          <div className="px-4 py-12 text-center text-slate-400">
            <p className="text-sm">Geen quizzen gevonden in deze categorie.</p>
          </div>
        )}
      </div>
    </div>
  );
}
