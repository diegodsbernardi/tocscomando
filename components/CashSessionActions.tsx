"use client";

import { confirmDialog, notifyDialog } from "@/components/ui/ConfirmDialog";
import { useTransition } from "react";
import { reopenSession, deleteSession } from "@/app/caixa/actions";

export function ReopenButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  async function onClick() {
    if (isPending) return;
    if (!(await confirmDialog("Reabrir essa sessão? Vai apagar o valor de fechamento."))) return;
    startTransition(async () => {
      const res = await reopenSession(id);
      if (!res.ok) notifyDialog(res.error || "Erro");
    });
  }

  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className="rounded-lg bg-warn-bg px-3 py-1.5 text-xs font-semibold text-warn hover:bg-warn-bg disabled:opacity-50"
    >
      {isPending ? "..." : "Reabrir"}
    </button>
  );
}

export function DeleteSessionButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  async function onClick() {
    if (isPending) return;
    if (!(await confirmDialog("Apagar essa sessão de caixa? Não dá pra desfazer."))) return;
    startTransition(async () => {
      const res = await deleteSession(id);
      if (!res.ok) notifyDialog(res.error || "Erro");
    });
  }

  return (
    <button
      onClick={onClick}
      disabled={isPending}
      aria-label="Apagar sessão"
      className="grid min-h-[40px] min-w-[36px] place-items-center rounded-lg px-2 text-sm text-danger hover:bg-danger-bg disabled:opacity-50"
    >
      {isPending ? "..." : "✕"}
    </button>
  );
}
