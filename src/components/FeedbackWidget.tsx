"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  X,
  Bug,
  Lightbulb,
  HelpCircle,
  Loader2,
  Trash2,
  Camera,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { submitFeedbackAction } from "@/actions/feedbackActions";

interface FeedbackWidgetProps {
  currentMemberName?: string;
}

export function FeedbackWidget({ currentMemberName }: FeedbackWidgetProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<"BUG" | "IDEA" | "QUESTION">("BUG");
  const [message, setMessage] = useState("");
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URL when changed/unmounted
  useEffect(() => {
    return () => {
      if (screenshotPreview) {
        URL.revokeObjectURL(screenshotPreview);
      }
    };
  }, [screenshotPreview]);

  const handleOpen = async () => {
    setIsOpen(true);
    setSubmitSuccess(false);
    setError(null);
    setMessage("");
    handleRemoveScreenshot();

    // Attempt automatic viewport snapshot
    if (typeof window !== "undefined") {
      try {
        setIsCapturing(true);
        const html2canvasModule = await import("html2canvas-pro");
        const html2canvas = html2canvasModule.default || html2canvasModule;

        const canvas = await html2canvas(document.body, {
          logging: false,
          useCORS: true,
          ignoreElements: (element) => element.classList?.contains("feedback-widget-root"),
        });

        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, "image/jpeg", 0.85);
        });

        if (blob) {
          setScreenshotBlob(blob);
          setScreenshotPreview(URL.createObjectURL(blob));
        }
      } catch (captureErr) {
        console.warn("Screenshot capture skipped or failed:", captureErr);
      } finally {
        setIsCapturing(false);
      }
    }
  };

  const handleRemoveScreenshot = () => {
    if (screenshotPreview) {
      URL.revokeObjectURL(screenshotPreview);
    }
    setScreenshotBlob(null);
    setScreenshotPreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (screenshotPreview) {
        URL.revokeObjectURL(screenshotPreview);
      }
      setScreenshotBlob(file);
      setScreenshotPreview(URL.createObjectURL(file));
    }
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 3) {
      setError("Beschrijf in minimaal 3 tekens wat er misgaat of beter kan.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("message", message.trim());
      formData.append("category", category);
      formData.append(
        "pageUrl",
        pathname || (typeof window !== "undefined" ? window.location.pathname : "/")
      );
      if (typeof window !== "undefined") {
        formData.append("userAgent", navigator.userAgent);
      }

      if (screenshotBlob) {
        formData.append("screenshot", screenshotBlob, "screenshot.jpg");
      }

      const res = await submitFeedbackAction(formData);
      if (!res.success) {
        throw new Error(res.error || "Fout bij verzenden van feedback.");
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitSuccess(false);
        setMessage("");
        handleRemoveScreenshot();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Er ging iets mis bij het versturen.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="feedback-widget-root">
      {/* Floating Trigger Pill */}
      {!isOpen && (
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Feedback melden"
          className="fixed right-5 bottom-5 z-40 flex items-center gap-2 rounded-full border border-slate-700/50 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-lg backdrop-blur-xs transition-all hover:bg-slate-800 active:scale-95"
        >
          <MessageSquare className="h-4 w-4 text-amber-400" />
          <span>Feedback</span>
        </button>
      )}

      {/* Modal / Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 backdrop-blur-xs sm:items-center sm:p-4">
          <div className="animate-in fade-in slide-in-from-bottom-4 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Meld feedback of een bug</h3>
                <p className="text-xs text-slate-500">Help ons KwisVrienden te verbeteren</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Form */}
            {submitSuccess ? (
              <div className="space-y-3 p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Bedankt voor je feedback!</h4>
                <p className="text-xs text-slate-500">
                  Je melding is succesvol doorgestuurd naar Marc.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-5">
                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Category Pills */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Categorie</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setCategory("BUG")}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition-all ${
                        category === "BUG"
                          ? "border-rose-300 bg-rose-50 text-rose-700 shadow-xs"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Bug className="h-3.5 w-3.5 text-rose-600" />
                      <span>Bug</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCategory("IDEA")}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition-all ${
                        category === "IDEA"
                          ? "border-amber-300 bg-amber-50 text-amber-800 shadow-xs"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
                      <span>Idee</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCategory("QUESTION")}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition-all ${
                        category === "QUESTION"
                          ? "border-blue-300 bg-blue-50 text-blue-700 shadow-xs"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <HelpCircle className="h-3.5 w-3.5 text-blue-600" />
                      <span>Vraag</span>
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Wat loopt er mis of kan beter?
                  </label>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Beschrijf wat je ziet of wat er gebeurt..."
                    className="w-full resize-none rounded-xl border border-slate-200 p-3 text-xs focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                    autoFocus
                  />
                </div>

                {/* Screenshot Area */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      Schermafbeelding (optioneel)
                    </label>
                    {screenshotPreview && (
                      <button
                        type="button"
                        onClick={handleRemoveScreenshot}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:underline"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Verwijderen</span>
                      </button>
                    )}
                  </div>

                  {isCapturing ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span>Scherm vastleggen...</span>
                    </div>
                  ) : screenshotPreview ? (
                    <div className="relative flex max-h-36 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      <Image
                        src={screenshotPreview}
                        alt="Screenshot preview"
                        width={400}
                        height={200}
                        unoptimized
                        className="max-h-36 w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-xs text-slate-600 transition-colors hover:bg-slate-50"
                      >
                        <Camera className="h-4 w-4 text-slate-400" />
                        <span>Foto of screenshot toevoegen</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Context Diagnostics Pill */}
                <div className="flex flex-wrap items-center justify-between gap-1 rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 text-[11px] text-slate-500">
                  <span>👤 {currentMemberName || "Aangemeld lid"}</span>
                  <span className="max-w-[150px] truncate font-mono text-[10px] text-slate-400">
                    {pathname || "/"}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || message.trim().length < 3}
                    className="flex flex-2 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Versturen...</span>
                      </>
                    ) : (
                      <span>Versturen</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
