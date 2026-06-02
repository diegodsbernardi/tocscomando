"use client";

import { useState, useTransition } from "react";
import { closeWeek, deleteShift } from "@/app/motoboys/actions";

export function DeleteShiftButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  function onClick() {
    if (isPending) return;
    if (!window.confirm("Apagar este turno? As corridas lançadas também serão removidas.")) return;
    startTransition(async () => {
      const res = await deleteShift(id);
      if (!res.ok) alert(res.error || "Erro");
    });
  }
  return (
    <button
      onClick={onClick}
      disabled={isPending}
      aria-label="Apagar turno"
      className="rounded-lg px-2 py-1 text-xs text-danger hover:bg-danger-bg disabled:opacity-50"
    >
      {isPending ? "..." : "✕"}
    </button>
  );
}

export function CloseWeekButton({
  weekStart,
  weekEnd,
  totalDue,
  pendingCount,
}: {
  weekStart: string;
  weekEnd: string;
  totalDue: number;
  pendingCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function onClick() {
    if (isPending || done) return;
    const msg = `Fechar semana e marcar ${pendingCount} turno(s) pendente(s) como pago(s)?`;
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("week_start", weekStart);
      fd.set("week_end", weekEnd);
      const res = await closeWeek(fd);
      if (!res.ok) alert(res.error || "Erro");
      else setDone(true);
    });
  }

  if (pendingCount === 0) {
    return (
      <span className="rounded-lg bg-line px-3 py-2 text-xs font-medium text-muted">
        Sem turnos pendentes
      </span>
    );
  }

  const brl = totalDue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <button
      onClick={onClick}
      disabled={isPending || done}
      className="rounded-lg bg-ok px-3 py-2 text-xs font-semibold text-white hover:brightness-90 disabled:opacity-50"
    >
      {isPending ? "Fechando..." : done ? "Semana fechada" : `Fechar semana (${brl})`}
    </button>
  );
}
