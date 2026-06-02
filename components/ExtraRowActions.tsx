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
          ? "bg-ok-bg text-ok hover:bg-ok-bg"
          : "bg-warn-bg text-warn hover:bg-warn-bg"
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
      className="rounded-lg px-2 py-1 text-xs text-danger hover:bg-danger-bg disabled:opacity-50"
    >
      {isPending ? "..." : "✕"}
    </button>
  );
}
