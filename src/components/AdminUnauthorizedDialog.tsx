"use client";

import { AlertDialog } from "@/components/AlertDialog";

export function AdminUnauthorizedDialog() {
  return (
    <AlertDialog
      isOpen={true}
      title="Toegang Gewijzigd"
      message="Je hebt geen beheerdersrechten meer om deze pagina te bekijken. Je rechten zijn gewijzigd door een andere beheerder."
      actionLabel="Naar Quizzen"
      variant="warning"
      onClose={() => {
        window.location.href = "/quizzes";
      }}
    />
  );
}
