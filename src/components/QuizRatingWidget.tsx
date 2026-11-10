"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { QuizRatingSummary } from "@/lib/ratingRules";
import { rateQuizAction } from "@/actions/ratingActions";

interface QuizRatingWidgetProps {
  quizId: string;
  summary: QuizRatingSummary;
  isConcluded: boolean;
  isEligible: boolean;
  isCancelled?: boolean;
  onRatingChange?: (newSummary: QuizRatingSummary) => void;
}

export function QuizRatingWidget({
  quizId,
  summary,
  isConcluded,
  isEligible,
  isCancelled = false,
  onRatingChange,
}: QuizRatingWidgetProps) {
  if (!isConcluded || isCancelled) {
    return null;
  }

  const [optimisticScore, setOptimisticScore] = useState<number | null>(null);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeScore = optimisticScore ?? summary.userScore;

  const handleRate = async (score: number) => {
    if (isSubmitting) return;

    setOptimisticScore(score);
    setIsSubmitting(true);
    setErrorMsg(null);

    const result = await rateQuizAction(quizId, score);
    setIsSubmitting(false);

    if (result.success) {
      setOptimisticScore(null);
      onRatingChange?.(result.summary);
    } else {
      setOptimisticScore(null);
      setErrorMsg(result.error);
    }
  };

  if (!isEligible) {
    return (
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="text-sm font-bold text-slate-800">Teambeoordeling</h4>
        {summary.count > 0 && summary.average !== null ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="flex items-center text-base font-extrabold text-amber-500">
              ★ {summary.average.toFixed(1)}
            </span>
            <span className="text-xs text-slate-500">
              ({summary.count} van {summary.totalEligible} spelers gestemd)
            </span>
          </div>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Nog geen beoordelingen</p>
        )}
      </div>
    );
  }

  const activeDisplayScore = hoverScore ?? activeScore ?? 0;

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900">Hoe was deze quiz?</h4>
        {activeScore !== null && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            Jouw stem: {activeScore}/5
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-slate-500">
        Jouw stem is anoniem en privé voor je teamgenoten.
      </p>

      {/* 5 Star Buttons */}
      <div className="mt-3 flex items-center gap-1.5" role="radiogroup" aria-label="Beoordeling">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= activeDisplayScore;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={activeScore === star}
              disabled={isSubmitting}
              onClick={() => handleRate(star)}
              onMouseEnter={() => setHoverScore(star)}
              onMouseLeave={() => setHoverScore(null)}
              aria-label={`${star} sterren`}
              className="rounded-lg p-1 text-slate-300 transition-colors hover:text-amber-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <Star
                className={`h-6 w-6 transition-transform hover:scale-110 ${
                  isFilled ? "fill-amber-400 text-amber-400" : "text-slate-300"
                }`}
              />
            </button>
          );
        })}
      </div>

      {errorMsg && <p className="mt-2 text-xs font-medium text-red-600">{errorMsg}</p>}

      {/* Teamscore footer */}
      <div className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
        {summary.count > 0 && summary.average !== null ? (
          <span>
            Teamscore: ★ {summary.average.toFixed(1)} / 5 ({summary.count} van{" "}
            {summary.totalEligible} spelers gestemd)
          </span>
        ) : (
          <span>Teamscore: Nog geen stemmen ({summary.totalEligible} spelers kunnen stemmen)</span>
        )}
      </div>
    </div>
  );
}
