"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, RefreshCw, XCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Stepper } from "@/components/ui/Stepper";
import {
  adminCancelQuizAction,
  adminResetRegistrationAction,
  adminUpdateTeamCapacityAction,
} from "@/actions/adminActions";

interface EditQuizClientProps {
  quizId: string;
  teamId: string;
  currentCapacity: number;
}

export function EditQuizClient({ quizId, teamId, currentCapacity }: EditQuizClientProps) {
  const router = useRouter();

  const [capacity, setCapacity] = useState(String(currentCapacity));
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUpdateCapacity = async () => {
    setLoading(true);
    await adminUpdateTeamCapacityAction(teamId, Number(capacity));
    setLoading(false);
    router.refresh();
  };

  const handleCancelQuiz = async () => {
    setShowCancelDialog(false);
    setLoading(true);
    await adminCancelQuizAction(quizId);
    router.push("/quizzes");
  };

  const handleResetRegistration = async () => {
    setShowResetDialog(false);
    setLoading(true);
    await adminResetRegistrationAction(teamId);
    setLoading(false);
    router.push(`/quizzes/${quizId}`);
  };

  return (
    <div className="flex-1 flex flex-col p-4 pb-20">
      <div className="flex items-center justify-between mb-4 pt-1">
        <Link
          href={`/quizzes/${quizId}`}
          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 text-sm font-semibold p-1 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Terug naar quiz</span>
        </Link>
        <span className="text-xs text-red-600 font-bold bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
          Admin Beheer
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-6">
        <h2 className="font-bold text-slate-900 text-base">Quiz Instellingen</h2>

        {/* Capacity adjustment */}
        <div className="pb-4 border-b border-slate-100">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Maximum Ploeggrootte Wijzigen
          </label>
          <p className="text-[11px] text-slate-500 mb-2">
            Bij het verlagen van de ploeggrootte worden de laatst toegevoegde spelers automatisch naar de reservelijst verplaatst.
          </p>
          <div className="flex items-center gap-3">
            <Stepper
              value={Number(capacity) || 4}
              min={1}
              max={10}
              onChange={(val) => setCapacity(String(val))}
            />
            <button
              type="button"
              onClick={handleUpdateCapacity}
              disabled={loading}
              className="py-2 px-4 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl"
            >
              Capaciteit Aanpassen
            </button>
          </div>
        </div>

        {/* Destructive Actions */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Beheersacties (Bevestiging vereist)
          </h3>

          <button
            type="button"
            onClick={() => setShowResetDialog(true)}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-900 text-xs font-medium transition-colors"
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-600" />
              <span>Inschrijving Ongedaan Maken</span>
            </div>
            <span className="text-[10px] bg-amber-200/60 px-2 py-0.5 rounded-full">Reset</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCancelDialog(true)}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-50 text-red-900 text-xs font-medium transition-colors"
          >
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <span>Quiz Annuleren (Naar Archief)</span>
            </div>
            <span className="text-[10px] bg-red-200/60 px-2 py-0.5 rounded-full">Annuleer</span>
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showCancelDialog}
        title="Quiz Annuleren?"
        message="Ben je zeker dat je deze quiz wilt annuleren? De quiz wordt verplaatst naar het Archief met een 'Geannuleerd' label."
        confirmLabel="Ja, Annuleer Quiz"
        isDestructive={true}
        onConfirm={handleCancelQuiz}
        onCancel={() => setShowCancelDialog(false)}
      />

      <ConfirmDialog
        isOpen={showResetDialog}
        title="Inschrijving Ongedaan Maken?"
        message="Ben je zeker dat je de inschrijvingsstatus wilt resetten? De quiz keert terug naar 'In Beraad'."
        confirmLabel="Ja, Reset Status"
        isDestructive={true}
        onConfirm={handleResetRegistration}
        onCancel={() => setShowResetDialog(false)}
      />
    </div>
  );
}
