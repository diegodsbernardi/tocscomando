"use client";

import { useTransition } from "react";
import { reopenSession, deleteSession } from "@/app/caixa/actions";

export function ReopenButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (isPending) return;
    if (!window.confirm("Reabrir essa sessão? Vai apagar o valor de fechamento.")) return;
    startTransition(async () => {
      const res = await reopenSession(id);
      if (!res.ok) alert(res.error || "Erro");
    });
  }

  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 disabled:opacity-50"
    >
      {isPending ? "..." : "Reabrir"}
    </button>
  );
}

export function DeleteSessionButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (isPending) return;
    if (!window.confirm("Apagar essa sessão de caixa? Não dá pra desfazer.")) return;
    startTransition(async () => {
      const res = await deleteSession(id);
      if (!res.ok) alert(res.error || "Erro");
    });
  }

  return (
    <button
      onClick={onClick}
      disabled={isPending}
      aria-label="Apagar sessão"
      className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? "..." : "✕"}
    </button>
  );
}
