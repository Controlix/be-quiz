"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FlyerUploader } from "@/components/FlyerUploader";
import { QuizMetadataFields } from "@/components/QuizMetadataFields";
import { Stepper } from "@/components/ui/Stepper";
import { createQuizAction } from "@/actions/quizActions";
import { formatStructuredEntryFee, parseStructuredEntryFee } from "@/services/quizService";
import { VisionExtractionResult } from "@/services/visionService";
import { useCapabilities } from "@/features/capabilities";
import {
  formatEuropeanDateString,
  formatEuropeanTimeString,
  parseEuropeanDateTime,
} from "@/lib/formatters";
import { AlertCircle } from "lucide-react";

interface QuizEntryFormProps {
  currentMemberId: string;
}

export function QuizEntryForm({ currentMemberId }: QuizEntryFormProps) {
  const router = useRouter();
  const { vision } = useCapabilities();
  const [tab, setTab] = useState<"SCAN" | "MANUAL">("SCAN");
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [maxTeamSize, setMaxTeamSize] = useState("4");
  const [organizerEmail, setOrganizerEmail] = useState("");
  const [registrationUrl, setRegistrationUrl] = useState("");
  const [entryFeeAmount, setEntryFeeAmount] = useState("");
  const [entryFeeUnit, setEntryFeeUnit] = useState<"TEAM" | "PERSON">("TEAM");
  const [flyerImageUrl, setFlyerImageUrl] = useState<string | undefined>();
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const handleExtraction = (result: VisionExtractionResult & { flyerImageUrl?: string }) => {
    if (result.flyerImageUrl) setFlyerImageUrl(result.flyerImageUrl);

    if (result.error) {
      setErrorBanner(result.error);
    } else {
      setErrorBanner(null);
    }

    if (result.data.title) setTitle(result.data.title);
    if (result.data.date) setDate(formatEuropeanDateString(result.data.date));
    if (result.data.time) setTime(formatEuropeanTimeString(result.data.time));
    if (result.data.location) setLocation(result.data.location);
    if (result.data.maxTeamSize) setMaxTeamSize(String(result.data.maxTeamSize));
    if (result.data.organizerEmail) setOrganizerEmail(result.data.organizerEmail);
    if (result.data.registrationUrl) setRegistrationUrl(result.data.registrationUrl);
    if (result.data.entryFee) {
      const parsedFee = parseStructuredEntryFee(result.data.entryFee);
      setEntryFeeAmount(parsedFee.amount);
      setEntryFeeUnit(parsedFee.unit);
    }

    setMissingFields(result.missingFields || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    const missing: string[] = [];
    if (!title.trim()) missing.push("title");
    if (!date.trim()) missing.push("date");
    if (!time.trim()) missing.push("time");
    if (!location.trim()) missing.push("location");
    if (!maxTeamSize || Number(maxTeamSize) <= 0) missing.push("maxTeamSize");

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

    setLoading(true);
    try {
      const parsedDate = parseEuropeanDateTime(
        date.includes("/") ? date : formatEuropeanDateString(date),
        time.includes(":") ? time : formatEuropeanTimeString(time)
      );

      if (!parsedDate) {
        setErrorBanner(
          "Gelieve een geldige datum (DD/MM/JJJJ) en 24-uurs tijd (bv. 20:00) in te voeren."
        );
        setLoading(false);
        return;
      }

      const startsAt = parsedDate;
      const formattedEntryFee = formatStructuredEntryFee(entryFeeAmount, entryFeeUnit);

      const res = await createQuizAction(
        {
          title,
          startsAt,
          location,
          maxTeamSize: Number(maxTeamSize),
          organizerEmail: organizerEmail || undefined,
          registrationUrl: registrationUrl || undefined,
          entryFee: formattedEntryFee,
          notes: undefined,
          flyerImageUrl,
        },
        currentMemberId
      );

      if (res.success && res.quizId) {
        router.push(`/quizzes/${res.quizId}`);
      } else {
        setErrorBanner(res.error || "Fout bij opslaan van de quiz.");
      }
    } catch (err: any) {
      setErrorBanner(err.message || "Fout bij opslaan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab selection (only if vision capability is enabled) */}
      {vision && (
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab("SCAN")}
            className={`flex-1 rounded-lg px-3 py-2 transition-all ${
              tab === "SCAN" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"
            }`}
          >
            📷 Flyer Scannen
          </button>
          <button
            type="button"
            onClick={() => setTab("MANUAL")}
            className={`flex-1 rounded-lg px-3 py-2 transition-all ${
              tab === "MANUAL" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"
            }`}
          >
            ✏️ Manueel Invoeren
          </button>
        </div>
      )}

      {vision && tab === "SCAN" && !flyerImageUrl && (
        <FlyerUploader onExtractionComplete={handleExtraction} />
      )}

      {!vision && !flyerImageUrl && <FlyerUploader onExtractionComplete={handleExtraction} />}

      {flyerImageUrl && (
        <div className="relative flex items-center justify-between overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
          <div className="flex items-center gap-3">
            <Image
              src={flyerImageUrl}
              alt="Flyer preview"
              width={48}
              height={48}
              unoptimized
              className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
            />
            <span className="text-xs font-semibold text-slate-700">Flyer toegevoegd</span>
          </div>
          <button
            type="button"
            onClick={() => setFlyerImageUrl(undefined)}
            className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700"
          >
            Verwijderen
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Review & Edit Form */}
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h3 className="mb-2 text-sm font-bold text-slate-900">Quiz Gegevens Controleren</h3>

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
          disabled={loading}
          teamSizeControl={
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Max Spelers *</label>
              <Stepper
                value={Number(maxTeamSize) || 4}
                min={1}
                max={10}
                onChange={(val) => {
                  setMaxTeamSize(String(val));
                  setMissingFields((prev) => prev.filter((f) => f !== "maxTeamSize"));
                }}
              />
            </div>
          }
        />

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50"
        >
          {loading ? "Opslaan..." : "Quiz Toevoegen & Delen"}
        </button>
      </form>
    </div>
  );
}
