"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlyerUploader } from "@/components/FlyerUploader";
import { createQuizAction } from "@/actions/quizActions";
import { VisionExtractionResult } from "@/services/visionService";
import { Calendar, MapPin, Users, Coins, Mail, Link as LinkIcon, AlertCircle } from "lucide-react";

interface QuizEntryFormProps {
  currentMemberId: string;
}

export function QuizEntryForm({ currentMemberId }: QuizEntryFormProps) {
  const router = useRouter();
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
  const [entryFee, setEntryFee] = useState("");
  const [notes, setNotes] = useState("");
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
    if (result.data.date) setDate(result.data.date);
    if (result.data.time) setTime(result.data.time);
    if (result.data.location) setLocation(result.data.location);
    if (result.data.maxTeamSize) setMaxTeamSize(String(result.data.maxTeamSize));
    if (result.data.organizerEmail) setOrganizerEmail(result.data.organizerEmail);
    if (result.data.registrationUrl) setRegistrationUrl(result.data.registrationUrl);
    if (result.data.entryFee) setEntryFee(result.data.entryFee);

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

    setLoading(true);
    try {
      const startsAt = new Date(`${date}T${time}:00`);

      const res = await createQuizAction(
        {
          title,
          startsAt,
          location,
          maxTeamSize: Number(maxTeamSize),
          organizerEmail: organizerEmail || undefined,
          registrationUrl: registrationUrl || undefined,
          entryFee: entryFee || undefined,
          notes: notes || undefined,
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
      {/* Tab selection */}
      <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
        <button
          type="button"
          onClick={() => setTab("SCAN")}
          className={`flex-1 py-2 px-3 rounded-lg transition-all ${
            tab === "SCAN" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"
          }`}
        >
          📷 Flyer Scannen
        </button>
        <button
          type="button"
          onClick={() => setTab("MANUAL")}
          className={`flex-1 py-2 px-3 rounded-lg transition-all ${
            tab === "MANUAL" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600"
          }`}
        >
          ✏️ Manueel Invoeren
        </button>
      </div>

      {tab === "SCAN" && <FlyerUploader onExtractionComplete={handleExtraction} />}

      {errorBanner && (
        <div className="flex items-center gap-2 text-xs text-red-800 bg-red-50 p-3 rounded-xl border border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Review & Edit Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-slate-900 mb-2">Quiz Gegevens Controleren</h3>

        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Kwis Titel *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setMissingFields((prev) => prev.filter((f) => f !== "title"));
            }}
            placeholder="bv. Grote Herfstquiz"
            className={`w-full text-sm p-2.5 rounded-xl border ${
              missingFields.includes("title") ? "border-red-500 bg-red-50/30" : "border-slate-200"
            }`}
          />
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Datum *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setMissingFields((prev) => prev.filter((f) => f !== "date"));
              }}
              className={`w-full text-sm p-2 rounded-xl border ${
                missingFields.includes("date") ? "border-red-500 bg-red-50/30" : "border-slate-200"
              }`}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Aanvangsuur *</label>
            <input
              type="time"
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setMissingFields((prev) => prev.filter((f) => f !== "time"));
              }}
              className={`w-full text-sm p-2 rounded-xl border ${
                missingFields.includes("time") ? "border-red-500 bg-red-50/30" : "border-slate-200"
              }`}
            />
          </div>
        </div>

        {/* Location & Team Size */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Locatie / Zaal *</label>
            <input
              type="text"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setMissingFields((prev) => prev.filter((f) => f !== "location"));
              }}
              placeholder="bv. Zaal Centrum, Gent"
              className={`w-full text-sm p-2 rounded-xl border ${
                missingFields.includes("location") ? "border-red-500 bg-red-50/30" : "border-slate-200"
              }`}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Max Spelers *</label>
            <input
              type="number"
              min="1"
              max="10"
              value={maxTeamSize}
              onChange={(e) => {
                setMaxTeamSize(e.target.value);
                setMissingFields((prev) => prev.filter((f) => f !== "maxTeamSize"));
              }}
              className={`w-full text-sm p-2 rounded-xl border text-center ${
                missingFields.includes("maxTeamSize") ? "border-red-500 bg-red-50/30" : "border-slate-200"
              }`}
            />
          </div>
        </div>

        {/* Contact Email & Fee */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Inschrijf Email</label>
            <input
              type="email"
              value={organizerEmail}
              onChange={(e) => setOrganizerEmail(e.target.value)}
              placeholder="organisatie@quiz.be"
              className="w-full text-xs p-2 rounded-xl border border-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Inschrijvingsgeld</label>
            <input
              type="text"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
              placeholder="bv. €20 / ploeg"
              className="w-full text-xs p-2 rounded-xl border border-slate-200"
            />
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 mt-4"
        >
          {loading ? "Opslaan..." : "Quiz Toevoegen & Delen"}
        </button>
      </form>
    </div>
  );
}
