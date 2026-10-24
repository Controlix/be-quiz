"use client";

import { useState } from "react";
import Link from "next/link";
import { INITIAL_MOCK_QUIZZES, MockQuiz } from "@/lib/mockData";
import { TimelineTabs, TabCategory, categorizeQuizForTabs } from "@/components/TimelineTabs";
import { QuizCard } from "@/components/QuizCard";
import { Plus, Trophy } from "lucide-react";

export default function QuizzesPage() {
  const [quizzes] = useState<MockQuiz[]>(INITIAL_MOCK_QUIZZES);
  const [activeTab, setActiveTab] = useState<TabCategory>("IN_BERAAD");

  const counts: Record<TabCategory, number> = {
    IN_BERAAD: quizzes.filter((q) => categorizeQuizForTabs(q) === "IN_BERAAD").length,
    GEPLAND: quizzes.filter((q) => categorizeQuizForTabs(q) === "GEPLAND").length,
    ARCHIEF: quizzes.filter((q) => categorizeQuizForTabs(q) === "ARCHIEF").length,
  };

  const filteredQuizzes = quizzes.filter((q) => categorizeQuizForTabs(q) === activeTab);

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

        <Link
          href="/quizzes/new"
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-sm active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nieuwe Quiz</span>
        </Link>
      </div>

      {/* Tabs */}
      <TimelineTabs activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />

      {/* List */}
      <div className="flex-1">
        {filteredQuizzes.length > 0 ? (
          filteredQuizzes.map((quiz) => <QuizCard key={quiz.id} quiz={quiz} />)
        ) : (
          <div className="text-center py-12 px-4 text-slate-400">
            <p className="text-sm">Geen quizzen gevonden in deze categorie.</p>
          </div>
        )}
      </div>
    </div>
  );
}
