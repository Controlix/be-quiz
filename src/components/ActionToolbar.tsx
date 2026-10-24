"use client";

import { useState } from "react";
import { Mail, Share2, Calendar, DollarSign, Check, Copy } from "lucide-react";
import { generateRegistrationMailto, getRegistrationEmailPlainText } from "@/lib/mailto";
import { generateGoogleCalendarUrl } from "@/lib/ical";
import { generateWhatsAppShareUrl } from "@/lib/whatsapp";

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

  const handleCopy = () => {
    const body = getRegistrationEmailPlainText(
      { title: quizTitle, startsAt: quizDate },
      { name: teamName },
      contactName
    );
    navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      {/* Primary Action: Register Team */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Ploeg Inschrijving</h4>
            <p className="text-xs text-slate-500">
              {isRegistered ? "Reeds officieel ingeschreven" : "Stuur mail naar organisatie"}
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
          <a
            href={mailtoUrl}
            onClick={() => {
              if (!isRegistered) {
                if (window.confirm("Heb je de mail verzonden naar de organisatie?")) {
                  onRegisterToggle();
                }
              }
            }}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm shadow-sm transition-all active:scale-[0.99]"
          >
            <Mail className="w-4 h-4" />
            <span>{isRegistered ? "Open Registratie Mail Opnieuw" : "Schrijf Ploeg In (Open Mail)"}</span>
          </a>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs text-slate-600 hover:text-slate-900 bg-slate-50 rounded-lg border border-slate-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Gekopieerd!" : "Kopieer mailtekst"}</span>
          </button>
        </div>
      </div>

      {/* Grid: Payment, WhatsApp, and Calendar */}
      <div className="grid grid-cols-3 gap-2">
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
          <DollarSign className={`w-4 h-4 mb-1 ${isPaid ? "text-emerald-600" : "text-slate-400"}`} />
          <span className="text-[11px] font-bold leading-tight">
            {isPaid ? "Betaald ✓" : "Inschrijfgeld"}
          </span>
          <span className="text-[9px] text-slate-500 mt-0.5 truncate max-w-full">
            {isPaid ? (paidByName ? `Door ${paidByName}` : "Betaald") : "Niet betaald"}
          </span>
        </button>

        {/* WhatsApp Share */}
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

        {/* Google Calendar */}
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
      </div>

      {quizId && (
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
