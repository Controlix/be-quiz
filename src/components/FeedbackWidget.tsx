"use client";

import { useState, useRef, useEffect } from "react";
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

    // Attempt automatic viewport snapshot
    if (typeof window !== "undefined") {
      try {
        setIsCapturing(true);
        const html2canvasModule = await import("html2canvas");
        const html2canvas = html2canvasModule.default;
        
        const canvas = await html2canvas(document.body, {
          logging: false,
          ignoreElements: (element) => element.classList?.contains("feedback-widget-root"),
        });

        canvas.toBlob(
          (blob) => {
            if (blob) {
              setScreenshotBlob(blob);
              setScreenshotPreview(URL.createObjectURL(blob));
            }
          },
          "image/jpeg",
          0.85
        );
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
      formData.append("pageUrl", pathname || (typeof window !== "undefined" ? window.location.pathname : "/"));
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
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-2.5 px-4 rounded-full shadow-lg border border-slate-700/50 backdrop-blur-xs transition-all active:scale-95"
        >
          <MessageSquare className="w-4 h-4 text-amber-400" />
          <span>Feedback</span>
        </button>
      )}

      {/* Modal / Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in slide-in-from-bottom-4 duration-200">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Meld feedback of een bug</h3>
                <p className="text-xs text-slate-500">Help ons KwisVrienden te verbeteren</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Form */}
            {submitSuccess ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">Bedankt voor je feedback!</h4>
                <p className="text-xs text-slate-500">Je melding is succesvol doorgestuurd naar Marc.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
                {error && (
                  <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Category Pills */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Categorie</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setCategory("BUG")}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        category === "BUG"
                          ? "bg-rose-50 border-rose-300 text-rose-700 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Bug className="w-3.5 h-3.5 text-rose-600" />
                      <span>Bug</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCategory("IDEA")}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        category === "IDEA"
                          ? "bg-amber-50 border-amber-300 text-amber-800 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                      <span>Idee</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCategory("QUESTION")}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        category === "QUESTION"
                          ? "bg-blue-50 border-blue-300 text-blue-700 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                      <span>Vraag</span>
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Wat loopt er mis of kan beter?
                  </label>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Beschrijf wat je ziet of wat er gebeurt..."
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none"
                    autoFocus
                  />
                </div>

                {/* Screenshot Area */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Schermafbeelding (optioneel)
                    </label>
                    {screenshotPreview && (
                      <button
                        type="button"
                        onClick={handleRemoveScreenshot}
                        className="text-[11px] font-semibold text-rose-600 hover:underline inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Verwijderen</span>
                      </button>
                    )}
                  </div>

                  {isCapturing ? (
                    <div className="flex items-center justify-center gap-2 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Scherm vastleggen...</span>
                    </div>
                  ) : screenshotPreview ? (
                    <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center max-h-36">
                      <img
                        src={screenshotPreview}
                        alt="Screenshot preview"
                        className="object-contain max-h-36 w-full"
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
                        className="w-full py-3 px-4 border border-dashed border-slate-300 rounded-xl text-xs text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
                      >
                        <Camera className="w-4 h-4 text-slate-400" />
                        <span>Foto of screenshot toevoegen</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Context Diagnostics Pill */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-1">
                  <span>👤 {currentMemberName || "Aangemeld lid"}</span>
                  <span className="font-mono text-[10px] text-slate-400 truncate max-w-[150px]">
                    {pathname || "/"}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || message.trim().length < 3}
                    className="flex-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
