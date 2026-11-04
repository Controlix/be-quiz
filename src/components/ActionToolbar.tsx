"use client";

import { useState } from "react";
import { Mail, Share2, Calendar, Check, Copy } from "lucide-react";
import {
  generateRegistrationMailto,
  getRegistrationEmailPlainText,
  generateWhatsAppShareUrl,
} from "@/features/sharing";
import { generateGoogleCalendarUrl } from "@/features/calendar";
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
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Ploeg Inschrijving</h4>
            <p className="text-xs text-slate-500">
              {isRegistered
                ? "Reeds officieel ingeschreven"
                : emailRegistration
                  ? "Stuur mail naar organisatie"
                  : "Status bijhouden voor het team"}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
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
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all active:scale-[0.99] ${
                isRegistered
                  ? "border border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              <Mail className="h-4 w-4" />
              <span>
                {isRegistered ? "Open Registratie Mail Opnieuw" : "Schrijf Ploeg In (Open Mail)"}
              </span>
            </a>
          )}

          {!isRegistered ? (
            <button
              type="button"
              onClick={onRegisterToggle}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
            >
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              <span>
                {emailRegistration
                  ? "Mail verzonden? Bevestig registratie"
                  : "Bevestig registratie"}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onRegisterToggle}
              className="flex w-full items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] text-slate-500 transition-colors hover:text-rose-600"
            >
              <span>Inschrijving heropenen / annuleren</span>
            </button>
          )}

          {emailRegistration && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 transition-colors hover:text-slate-900"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
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
          className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition-all ${
            isPaid
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <span
            className={`mb-1 text-sm leading-none font-bold ${isPaid ? "text-emerald-600" : "text-slate-400"}`}
          >
            €
          </span>
          <span className="text-[11px] leading-tight font-bold">
            {isPaid ? "Betaald ✓" : "Inschrijfgeld"}
          </span>
          <span className="mt-0.5 max-w-full truncate text-[9px] text-slate-500">
            {isPaid ? (paidByName ? `Door ${paidByName}` : "Betaald") : "Niet betaald"}
          </span>
        </button>

        {/* WhatsApp Share */}
        {whatsappShare && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 text-center text-slate-700 transition-all hover:bg-slate-50"
          >
            <Share2 className="mb-1 h-4 w-4 text-[#25D366]" />
            <span className="text-[11px] leading-tight font-bold">WhatsApp</span>
            <span className="mt-0.5 text-[9px] text-slate-500">Deel in groep</span>
          </a>
        )}

        {/* Google Calendar */}
        {icalExport && (
          <a
            href={googleCalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 text-center text-slate-700 transition-all hover:bg-slate-50"
          >
            <Calendar className="mb-1 h-4 w-4 text-blue-600" />
            <span className="text-[11px] leading-tight font-bold">In Agenda</span>
            <span className="mt-0.5 text-[9px] text-slate-500">Google Agenda</span>
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
