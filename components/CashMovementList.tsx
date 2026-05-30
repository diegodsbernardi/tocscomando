"use client";

import { useTransition } from "react";
import { deleteMovement } from "@/app/caixa/actions";
import { brl } from "@/lib/format";

export type Movement = {
  id: string;
  direction: "in" | "out";
  category: string;
  amount: number;
  note: string | null;
  created_at: string;
};

export function CashMovementList({ items }: { items: Movement[] }) {
  if (items.length === 0) {
    return (
      <p className="py-2 text-center text-sm text-muted">
        Nenhuma movimentação ainda.
      </p>
    );
  }
  return (
    <div className="divide-y divide-line">
      {items.map((m) => (
        <Row key={m.id} item={m} />
      ))}
    </div>
  );
}

function Row({ item: m }: { item: Movement }) {
  const [isPending, startTransition] = useTransition();
  const isOut = m.direction === "out";

  function onDelete() {
    if (isPending) return;
    if (!window.confirm("Apagar essa movimentação?")) return;
    startTransition(async () => {
      const res = await deleteMovement(m.id);
      if (!res.ok) alert(res.error || "Erro");
    });
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <span
        className={`grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-[10px] text-lg font-bold ${
          isOut ? "bg-danger-bg text-danger" : "bg-ok-bg text-ok"
        }`}
      >
        {isOut ? "↓" : "↑"}
      </span>
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-[13px]">{m.category}</strong>
        <small className="block truncate text-[11px] text-muted">
          {m.note || "—"}
        </small>
      </div>
      <div
        className={`text-sm font-bold tabular-nums ${
          isOut ? "text-danger" : "text-ok"
        }`}
      >
        {isOut ? "−" : "+"}
        {brl(m.amount)}
      </div>
      <button
        onClick={onDelete}
        disabled={isPending}
        aria-label="Apagar"
        className="rounded p-1 text-xs text-muted hover:bg-line disabled:opacity-50"
      >
        ✕
      </button>
    </div>
  );
}
