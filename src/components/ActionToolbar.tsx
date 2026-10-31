"use client";

import { useState } from "react";
import { Mail, Share2, Calendar, Check, Copy } from "lucide-react";
import { generateRegistrationMailto, getRegistrationEmailPlainText } from "@/lib/mailto";
import { generateGoogleCalendarUrl } from "@/lib/ical";
import { generateWhatsAppShareUrl } from "@/lib/whatsapp";
import { useCapabilities } from "@/features/capabilities";

interface ActionToolbarProps {
  quizId?: string;
  quizTitle: string;
  quizDate: Date;
  location?: string;
  durationMinutes?: number;
  organizerEmail?: string;
  isRegistered: boolean;
  isPaid: boolean;
  paidByName?: string;
  teamName: string;
  contactName?: string;
  onRegisterToggle: () => void;
  onPaymentToggle: () => void;
}

export function ActionToolbar({
  quizId,
  quizTitle,
  quizDate,
  location = "Vlaanderen",
  durationMinutes = 180,
  organizerEmail,
  isRegistered,
  isPaid,
  paidByName,
  teamName,
  contactName = "Marc",
  onRegisterToggle,
  onPaymentToggle,
}: ActionToolbarProps) {
  const { icalExport, whatsappShare, emailRegistration } = useCapabilities();
  const [copied, setCopied] = useState(false);

  const mailtoUrl = generateRegistrationMailto(
    { title: quizTitle, startsAt: quizDate, organizerEmail: organizerEmail || null },
    { name: teamName },
    contactName
  );

  const googleCalUrl = generateGoogleCalendarUrl(
    { title: quizTitle, startsAt: quizDate, durationMinutes, location },
    { name: teamName, paidAt: isPaid ? new Date() : null }
  );

  const appUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const whatsappUrl = generateWhatsAppShareUrl(
    { id: quizId, title: quizTitle, startsAt: quizDate, location },
    { name: teamName },
    appUrl
  );

  const copyFallback = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    } catch (err) {
      console.warn("Clipboard copy fallback failed:", err);
    }
  };

  const handleCopy = () => {
    const body = getRegistrationEmailPlainText(
      { title: quizTitle, startsAt: quizDate },
      { name: teamName },
      contactName
    );
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(body).catch(() => copyFallback(body));
    } else {
      copyFallback(body);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const auxCount = (whatsappShare ? 1 : 0) + (icalExport ? 1 : 0);
  const gridClass =
    auxCount === 2
      ? "grid grid-cols-3 gap-2"
      : auxCount === 1
      ? "grid grid-cols-2 gap-2"
      : "grid grid-cols-1 gap-2";

  return (
    <div className="space-y-3">
      {/* Primary Action: Register Team */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Ploeg Inschrijving</h4>
            <p className="text-xs text-slate-500">
              {isRegistered
                ? "Reeds officieel ingeschreven"
                : emailRegistration
                ? "Stuur mail naar organisatie"
                : "Status bijhouden voor het team"}
            </p>
          </div>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              isRegistered ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
            }`}
          >
            {isRegistered ? "✓ Ingeschreven" : "Nog open"}
          </span>
        </div>

        <div className="space-y-2">
          {emailRegistration && (
            <a
              href={mailtoUrl}
              className={`w-full flex items-center justify-center gap-2 font-semibold py-2.5 px-4 rounded-xl text-sm shadow-sm transition-all active:scale-[0.99] ${
                isRegistered
                  ? "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>{isRegistered ? "Open Registratie Mail Opnieuw" : "Schrijf Ploeg In (Open Mail)"}</span>
            </a>
          )}

          {!isRegistered ? (
            <button
              type="button"
              onClick={onRegisterToggle}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {emailRegistration ? "Mail verzonden? Bevestig registratie" : "Bevestig registratie"}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onRegisterToggle}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-[11px] text-slate-500 hover:text-rose-600 transition-colors"
            >
              <span>Inschrijving heropenen / annuleren</span>
            </button>
          )}

          {emailRegistration && (
            <button
              type="button"
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs text-slate-600 hover:text-slate-900 bg-slate-50 rounded-lg border border-slate-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Gekopieerd!" : "Kopieer mailtekst"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid: Payment, WhatsApp, and Calendar */}
      <div className={gridClass}>
        {/* Payment toggle */}
        <button
          type="button"
          onClick={onPaymentToggle}
          className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
            isPaid
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
        >
          <span className={`text-sm font-bold mb-1 leading-none ${isPaid ? "text-emerald-600" : "text-slate-400"}`}>
            €
          </span>
          <span className="text-[11px] font-bold leading-tight">
            {isPaid ? "Betaald ✓" : "Inschrijfgeld"}
          </span>
          <span className="text-[9px] text-slate-500 mt-0.5 truncate max-w-full">
            {isPaid ? (paidByName ? `Door ${paidByName}` : "Betaald") : "Niet betaald"}
          </span>
        </button>

        {/* WhatsApp Share */}
        {whatsappShare && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-center transition-all"
          >
            <Share2 className="w-4 h-4 mb-1 text-[#25D366]" />
            <span className="text-[11px] font-bold leading-tight">WhatsApp</span>
            <span className="text-[9px] text-slate-500 mt-0.5">Deel in groep</span>
          </a>
        )}

        {/* Google Calendar */}
        {icalExport && (
          <a
            href={googleCalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-center transition-all"
          >
            <Calendar className="w-4 h-4 mb-1 text-blue-600" />
            <span className="text-[11px] font-bold leading-tight">In Agenda</span>
            <span className="text-[9px] text-slate-500 mt-0.5">Google Agenda</span>
          </a>
        )}
      </div>

      {icalExport && quizId && (
        <div className="text-center">
          <a
            href={`/api/quizzes/${quizId}/calendar.ics`}
            className="text-[11px] text-blue-600 hover:underline"
          >
            Download .ics bestand (Apple / Outlook)
          </a>
        </div>
      )}
    </div>
  );
}
