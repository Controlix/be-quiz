"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, XCircle } from "lucide-react";
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
    <div className="flex flex-1 flex-col p-4 pb-20">
      <div className="mb-4 flex items-center justify-between pt-1">
        <Link
          href={`/quizzes/${quizId}`}
          className="-ml-1 inline-flex items-center gap-1 rounded-lg p-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Terug naar quiz</span>
        </Link>
        <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-600">
          Admin Beheer
        </span>
      </div>

      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Quiz Instellingen</h2>

        {/* Capacity adjustment */}
        <div className="border-b border-slate-100 pb-4">
          <label className="mb-1 block text-xs font-bold text-slate-700">
            Maximum Ploeggrootte Wijzigen
          </label>
          <p className="mb-2 text-[11px] text-slate-500">
            Bij het verlagen van de ploeggrootte worden de laatst toegevoegde spelers automatisch
            naar de reservelijst verplaatst.
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
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
            >
              Capaciteit Aanpassen
            </button>
          </div>
        </div>

        {/* Destructive Actions */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
            Beheersacties (Bevestiging vereist)
          </h3>

          <button
            type="button"
            onClick={() => setShowResetDialog(true)}
            className="flex w-full items-center justify-between rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-50"
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-amber-600" />
              <span>Inschrijving Ongedaan Maken</span>
            </div>
            <span className="rounded-full bg-amber-200/60 px-2 py-0.5 text-[10px]">Reset</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCancelDialog(true)}
            className="flex w-full items-center justify-between rounded-xl border border-red-200 bg-red-50/50 p-3 text-xs font-medium text-red-900 transition-colors hover:bg-red-50"
          >
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span>Quiz Annuleren (Naar Archief)</span>
            </div>
            <span className="rounded-full bg-red-200/60 px-2 py-0.5 text-[10px]">Annuleer</span>
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
