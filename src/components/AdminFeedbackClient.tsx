"use client";

import { useState } from "react";
import Image from "next/image";
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
import { toggleFeedbackResolvedAction, deleteFeedbackAction } from "@/actions/feedbackActions";

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
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
            <Bug className="h-3 w-3 text-rose-600" />
            <span>Bug</span>
          </span>
        );
      case "IDEA":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
            <Lightbulb className="h-3 w-3 text-amber-600" />
            <span>Idee</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
            <HelpCircle className="h-3 w-3 text-blue-600" />
            <span>Vraag</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Filter Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setStatusFilter("OPEN")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-center transition-all ${
            statusFilter === "OPEN"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>Openstaand</span>
          {openCount > 0 && (
            <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {openCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("RESOLVED")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-center transition-all ${
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
          className={`flex-1 rounded-lg px-3 py-1.5 text-center transition-all ${
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
          className={`rounded-lg border px-2.5 py-1 font-medium whitespace-nowrap transition-colors ${
            categoryFilter === "ALL"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Alle types
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter("BUG")}
          className={`rounded-lg border px-2.5 py-1 font-medium whitespace-nowrap transition-colors ${
            categoryFilter === "BUG"
              ? "border-rose-600 bg-rose-600 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          🐛 Bugs
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter("IDEA")}
          className={`rounded-lg border px-2.5 py-1 font-medium whitespace-nowrap transition-colors ${
            categoryFilter === "IDEA"
              ? "border-amber-600 bg-amber-600 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          💡 Ideeën
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter("QUESTION")}
          className={`rounded-lg border px-2.5 py-1 font-medium whitespace-nowrap transition-colors ${
            categoryFilter === "QUESTION"
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          💬 Vragen
        </button>
      </div>

      {/* Feedback List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
            Geen meldingen gevonden voor deze selectie.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border p-4 transition-all ${
                item.isResolved
                  ? "border-slate-200 bg-slate-50/70 text-slate-600"
                  : "border-slate-200 bg-white shadow-xs"
              }`}
            >
              {/* Top row: Category, Member, Timestamp */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getCategoryBadge(item.category)}
                  <span className="text-xs font-bold text-slate-800">
                    {item.member?.name || "Onbekend lid"}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Clock className="h-3 w-3" />
                  <span>{formatEuropeanDateTime(new Date(item.createdAt))}</span>
                </div>
              </div>

              {/* Message text */}
              <p className="mb-3 text-xs leading-relaxed font-normal whitespace-pre-wrap text-slate-900">
                {item.message}
              </p>

              {/* Screenshot thumbnail if available */}
              {item.screenshot && (
                <div className="mb-3">
                  <div
                    onClick={() => setActiveScreenshotUrl(item.screenshot!)}
                    className="group relative inline-block max-w-[200px] cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100 transition-all hover:border-blue-400"
                  >
                    <Image
                      src={item.screenshot}
                      alt={`Screenshot voor ${item.id}`}
                      width={200}
                      height={96}
                      unoptimized
                      className="max-h-24 w-auto object-cover transition-opacity group-hover:opacity-90"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <Maximize2 className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              )}

              {/* Diagnostics metadata row */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-1 rounded-xl border border-slate-200/60 bg-slate-50 p-2 text-[10px] text-slate-500">
                <span
                  className="flex max-w-[200px] items-center gap-1 truncate"
                  title={item.pageUrl}
                >
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                  <span className="font-mono">{item.pageUrl}</span>
                </span>
                {item.userAgent && (
                  <span
                    className="flex max-w-[150px] items-center gap-1 truncate text-slate-400"
                    title={item.userAgent}
                  >
                    <Laptop className="h-3 w-3" />
                    <span>{item.userAgent.split(" ")[0]}</span>
                  </span>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-1">
                <button
                  type="button"
                  onClick={() => handleToggleResolved(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    item.isResolved
                      ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      : "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{item.isResolved ? "Heropenen" : "Markeer als opgelost"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  title="Verwijderen"
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setActiveScreenshotUrl(null)}
        >
          <div
            className="relative flex max-h-[90vh] max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-white">
              <span className="text-xs font-semibold">Screenshot bekijken</span>
              <button
                type="button"
                onClick={() => setActiveScreenshotUrl(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-center overflow-auto p-2">
              <Image
                src={activeScreenshotUrl}
                alt="Screenshot in detail"
                width={1200}
                height={800}
                unoptimized
                className="max-h-[75vh] w-auto rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
