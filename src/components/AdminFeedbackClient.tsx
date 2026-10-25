"use client";

import { useState } from "react";
import {
  Bug,
  Lightbulb,
  HelpCircle,
  CheckCircle2,
  Clock,
  Trash2,
  X,
  Maximize2,
  ExternalLink,
  Laptop,
} from "lucide-react";
import { formatEuropeanDateTime } from "@/lib/formatters";
import {
  toggleFeedbackResolvedAction,
  deleteFeedbackAction,
} from "@/actions/feedbackActions";

export interface FeedbackItem {
  id: string;
  category: "BUG" | "IDEA" | "QUESTION";
  message: string;
  pageUrl: string;
  userAgent?: string | null;
  screenshot?: string | null;
  isResolved: boolean;
  resolvedAt?: Date | string | null;
  createdAt: Date | string;
  member?: {
    id: string;
    name: string;
  } | null;
}

interface AdminFeedbackClientProps {
  initialFeedbacks: FeedbackItem[];
}

export function AdminFeedbackClient({ initialFeedbacks }: AdminFeedbackClientProps) {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(initialFeedbacks);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "RESOLVED">("OPEN");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "BUG" | "IDEA" | "QUESTION">("ALL");
  const [activeScreenshotUrl, setActiveScreenshotUrl] = useState<string | null>(null);

  const filtered = feedbacks.filter((item) => {
    if (statusFilter === "OPEN" && item.isResolved) return false;
    if (statusFilter === "RESOLVED" && !item.isResolved) return false;
    if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
    return true;
  });

  const openCount = feedbacks.filter((f) => !f.isResolved).length;
  const resolvedCount = feedbacks.filter((f) => f.isResolved).length;

  const handleToggleResolved = async (id: string) => {
    const originalFeedbacks = feedbacks;
    setFeedbacks((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              isResolved: !f.isResolved,
              resolvedAt: !f.isResolved ? new Date() : null,
            }
          : f
      )
    );
    try {
      const res = await toggleFeedbackResolvedAction(id);
      if (!res.success) {
        setFeedbacks(originalFeedbacks);
        window.alert(res.error || "Kon status niet bijwerken.");
      }
    } catch (err: any) {
      setFeedbacks(originalFeedbacks);
      window.alert(err.message || "Er ging iets mis bij het bijwerken.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Ben je zeker dat je deze melding wilt verwijderen?")) {
      const originalFeedbacks = feedbacks;
      setFeedbacks((prev) => prev.filter((f) => f.id !== id));
      try {
        const res = await deleteFeedbackAction(id);
        if (!res.success) {
          setFeedbacks(originalFeedbacks);
          window.alert(res.error || "Kon melding niet verwijderen.");
        }
      } catch (err: any) {
        setFeedbacks(originalFeedbacks);
        window.alert(err.message || "Er ging iets mis bij het verwijderen.");
      }
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "BUG":
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[11px] font-bold">
            <Bug className="w-3 h-3 text-rose-600" />
            <span>Bug</span>
          </span>
        );
      case "IDEA":
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full text-[11px] font-bold">
            <Lightbulb className="w-3 h-3 text-amber-600" />
            <span>Idee</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[11px] font-bold">
            <HelpCircle className="w-3 h-3 text-blue-600" />
            <span>Vraag</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Filter Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setStatusFilter("OPEN")}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
            statusFilter === "OPEN"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>Openstaand</span>
          {openCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {openCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("RESOLVED")}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
            statusFilter === "RESOLVED"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>Opgelost</span>
          <span className="text-[10px] text-slate-400">({resolvedCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("ALL")}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all text-center ${
            statusFilter === "ALL"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Alle ({feedbacks.length})
        </button>
      </div>

      {/* Category Sub-Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setCategoryFilter("ALL")}
          className={`px-2.5 py-1 rounded-lg border font-medium whitespace-nowrap transition-colors ${
            categoryFilter === "ALL"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Alle types
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter("BUG")}
          className={`px-2.5 py-1 rounded-lg border font-medium whitespace-nowrap transition-colors ${
            categoryFilter === "BUG"
              ? "bg-rose-600 text-white border-rose-600"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          🐛 Bugs
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter("IDEA")}
          className={`px-2.5 py-1 rounded-lg border font-medium whitespace-nowrap transition-colors ${
            categoryFilter === "IDEA"
              ? "bg-amber-600 text-white border-amber-600"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          💡 Ideeën
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter("QUESTION")}
          className={`px-2.5 py-1 rounded-lg border font-medium whitespace-nowrap transition-colors ${
            categoryFilter === "QUESTION"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          💬 Vragen
        </button>
      </div>

      {/* Feedback List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
            Geen meldingen gevonden voor deze selectie.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all ${
                item.isResolved
                  ? "bg-slate-50/70 border-slate-200 text-slate-600"
                  : "bg-white border-slate-200 shadow-xs"
              }`}
            >
              {/* Top row: Category, Member, Timestamp */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getCategoryBadge(item.category)}
                  <span className="text-xs font-bold text-slate-800">
                    {item.member?.name || "Onbekend lid"}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>{formatEuropeanDateTime(new Date(item.createdAt))}</span>
                </div>
              </div>

              {/* Message text */}
              <p className="text-xs text-slate-900 leading-relaxed font-normal whitespace-pre-wrap mb-3">
                {item.message}
              </p>

              {/* Screenshot thumbnail if available */}
              {item.screenshot && (
                <div className="mb-3">
                  <div
                    onClick={() => setActiveScreenshotUrl(item.screenshot!)}
                    className="group relative inline-block cursor-pointer rounded-xl overflow-hidden border border-slate-200 bg-slate-100 hover:border-blue-400 transition-all max-w-[200px]"
                  >
                    <img
                      src={item.screenshot}
                      alt={`Screenshot voor ${item.id}`}
                      className="max-h-24 w-auto object-cover group-hover:opacity-90 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                      <Maximize2 className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              )}

              {/* Diagnostics metadata row */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-2 text-[10px] text-slate-500 flex flex-wrap items-center justify-between gap-1 mb-3">
                <span className="flex items-center gap-1 truncate max-w-[200px]" title={item.pageUrl}>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                  <span className="font-mono">{item.pageUrl}</span>
                </span>
                {item.userAgent && (
                  <span className="flex items-center gap-1 text-slate-400 truncate max-w-[150px]" title={item.userAgent}>
                    <Laptop className="w-3 h-3" />
                    <span>{item.userAgent.split(" ")[0]}</span>
                  </span>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleToggleResolved(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    item.isResolved
                      ? "bg-slate-100 hover:bg-slate-200 text-slate-600"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{item.isResolved ? "Heropenen" : "Markeer als opgelost"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  title="Verwijderen"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Screenshot Lightbox Modal */}
      {activeScreenshotUrl && (
        <div
          role="dialog"
          aria-label="Screenshot bekijken"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setActiveScreenshotUrl(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2 border border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 text-white border-b border-slate-800">
              <span className="text-xs font-semibold">Screenshot bekijken</span>
              <button
                type="button"
                onClick={() => setActiveScreenshotUrl(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center">
              <img
                src={activeScreenshotUrl}
                alt="Screenshot in detail"
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
