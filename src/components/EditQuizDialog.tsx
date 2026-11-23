"use client";

import { useState } from "react";
import { AlertCircle, Pencil, X } from "lucide-react";
import { QuizMetadataFields } from "@/components/QuizMetadataFields";
import { formatStructuredEntryFee, parseStructuredEntryFee } from "@/services/quizService";
import { formatEuropeanDate, formatEuropeanTime, parseEuropeanDateTime } from "@/lib/formatters";
import type { UpdateQuizMetadataInput } from "@/actions/quizActions";

export interface EditableQuizMetadata {
  title: string;
  startsAt: Date | string;
  location: string;
  organizerEmail: string | null;
  entryFee: string | null;
}

export interface EditQuizDialogProps {
  isOpen: boolean;
  quiz: EditableQuizMetadata;
  onClose: () => void;
  onSave: (payload: UpdateQuizMetadataInput) => Promise<void>;
}

export function EditQuizDialog(props: EditQuizDialogProps) {
  if (!props.isOpen) return null;
  return <EditQuizDialogContent {...props} />;
}

function EditQuizDialogContent({ quiz, onClose, onSave }: EditQuizDialogProps) {
  const initialFee = parseStructuredEntryFee(quiz.entryFee);

  const [title, setTitle] = useState(quiz.title);
  const [date, setDate] = useState(formatEuropeanDate(quiz.startsAt));
  const [time, setTime] = useState(formatEuropeanTime(quiz.startsAt));
  const [location, setLocation] = useState(quiz.location);
  const [organizerEmail, setOrganizerEmail] = useState(quiz.organizerEmail ?? "");
  const [entryFeeAmount, setEntryFeeAmount] = useState(initialFee.amount);
  const [entryFeeUnit, setEntryFeeUnit] = useState<"TEAM" | "PERSON">(initialFee.unit);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    const missing: string[] = [];
    if (!title.trim()) missing.push("title");
    if (!date.trim()) missing.push("date");
    if (!time.trim()) missing.push("time");
    if (!location.trim()) missing.push("location");

    if (missing.length > 0) {
      setMissingFields(missing);
      setErrorBanner("Gelieve alle verplichte velden (in het rood) in te vullen.");
      return;
    }

    if (organizerEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(organizerEmail.trim())) {
        setErrorBanner("Ongeldig e-mailadres voor organisatie.");
        return;
      }
    }

    const parsedDate = parseEuropeanDateTime(date, time);
    if (!parsedDate) {
      setErrorBanner(
        "Gelieve een geldige datum (DD/MM/JJJJ) en 24-uurs tijd (bv. 20:00) in te voeren."
      );
      return;
    }

    const formattedFee = formatStructuredEntryFee(entryFeeAmount, entryFeeUnit) ?? null;
    const normalizedEmail = organizerEmail.trim() || null;

    setIsSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        startsAt: parsedDate,
        location: location.trim(),
        organizerEmail: normalizedEmail,
        entryFee: formattedFee,
      });
      onClose();
    } catch (err: any) {
      setErrorBanner(err?.message || "Fout bij opslaan van quizgegevens.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl transition-all">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Pencil className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-slate-900">Quizgegevens bewerken</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Sluiten"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {errorBanner && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{errorBanner}</span>
            </div>
          )}

          <QuizMetadataFields
            title={title}
            onTitleChange={(value) => {
              setTitle(value);
              setMissingFields((prev) => prev.filter((f) => f !== "title"));
            }}
            date={date}
            onDateChange={(value) => {
              setDate(value);
              setMissingFields((prev) => prev.filter((f) => f !== "date"));
            }}
            time={time}
            onTimeChange={(value) => {
              setTime(value);
              setMissingFields((prev) => prev.filter((f) => f !== "time"));
            }}
            location={location}
            onLocationChange={(value) => {
              setLocation(value);
              setMissingFields((prev) => prev.filter((f) => f !== "location"));
            }}
            organizerEmail={organizerEmail}
            onOrganizerEmailChange={setOrganizerEmail}
            entryFeeAmount={entryFeeAmount}
            onEntryFeeAmountChange={setEntryFeeAmount}
            entryFeeUnit={entryFeeUnit}
            onEntryFeeUnitChange={setEntryFeeUnit}
            missingFields={missingFields}
            disabled={isSubmitting}
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
