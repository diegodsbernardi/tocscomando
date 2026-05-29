"use client";

import { useTransition } from "react";
import { markPaid, markUnpaid, deleteExtra } from "@/app/extras/actions";

export function MarkPaidToggle({ id, paid }: { id: string; paid: boolean }) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    if (isPending) return;
    startTransition(async () => {
      const res = paid ? await markUnpaid(id) : await markPaid(id);
      if (!res.ok) alert(res.error || "Erro");
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
        paid
          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
          : "bg-amber-100 text-amber-700 hover:bg-amber-200"
      }`}
    >
      {isPending ? "..." : paid ? "Pago" : "Pagar"}
    </button>
  );
}

export function DeleteExtraButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (isPending) return;
    if (!window.confirm("Apagar este extra?")) return;
    startTransition(async () => {
      const res = await deleteExtra(id);
      if (!res.ok) alert(res.error || "Erro");
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label="Apagar extra"
      className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? "..." : "✕"}
    </button>
  );
}
