import { useState } from "react";
import { Mail, Share2, Calendar, DollarSign, Check, Copy } from "lucide-react";

interface ActionToolbarProps {
  quizTitle: string;
  quizDate: Date;
  organizerEmail?: string;
  isRegistered: boolean;
  isPaid: boolean;
  paidByName?: string;
  teamName: string;
  onRegisterToggle: () => void;
  onPaymentToggle: () => void;
}

export function ActionToolbar({
  quizTitle,
  quizDate,
  organizerEmail,
  isRegistered,
  isPaid,
  paidByName,
  teamName,
  onRegisterToggle,
  onPaymentToggle,
}: ActionToolbarProps) {
  const [copied, setCopied] = useState(false);

  const formattedDate = new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(quizDate));

  // Decision D2: Team name only, NO player names or player counts
  const mailSubject = encodeURIComponent(`Inschrijving quiz: ${quizTitle} - ${teamName}`);
  const mailBody = encodeURIComponent(
    `Beste organisatie,\n\nGraag schrijven wij onze ploeg in voor ${quizTitle} op ${formattedDate}:\n\nPloegnaam: ${teamName}\nContactpersoon: Marc\n\nMet vriendelijke groeten,\nMarc`
  );
  const mailtoUrl = `mailto:${organizerEmail || ""}?subject=${mailSubject}&body=${mailBody}`;

  const shareText = encodeURIComponent(
    `🏆 Kwis: *${quizTitle}* op ${formattedDate}!\nPloeg: ${teamName}\nBekijk de details en stem af via de app!`
  );
  const whatsappUrl = `https://wa.me/?text=${shareText}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(decodeURIComponent(mailBody));
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
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs text-slate-600 hover:text-slate-900 bg-slate-50 rounded-lg border border-slate-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Gekopieerd!" : "Kopieer mailtekst"}</span>
          </button>
        </div>
      </div>

      {/* Payment and Sharing Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Payment toggle */}
        <button
          onClick={onPaymentToggle}
          className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all ${
            isPaid
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
        >
          <DollarSign className={`w-5 h-5 mb-1 ${isPaid ? "text-emerald-600" : "text-slate-400"}`} />
          <span className="text-xs font-bold leading-tight">
            {isPaid ? "Betaald ✓" : "Inschrijvingsgeld"}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5">
            {isPaid ? (paidByName ? `Door ${paidByName}` : "Betaald") : "Tik om te markeren"}
          </span>
        </button>

        {/* WhatsApp Share */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-center transition-all"
        >
          <Share2 className="w-5 h-5 mb-1 text-[#25D366]" />
          <span className="text-xs font-bold leading-tight">Deel WhatsApp</span>
          <span className="text-[10px] text-slate-500 mt-0.5">Stuur naar groep</span>
        </a>
      </div>
    </div>
  );
}
