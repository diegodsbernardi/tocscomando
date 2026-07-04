"use client";

import { confirmDialog, notifyDialog } from "@/components/ui/ConfirmDialog";
import { useTransition } from "react";
import { markPaid, markUnpaid, deleteExtra } from "@/app/extras/actions";

export function MarkPaidToggle({ id, paid }: { id: string; paid: boolean }) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    if (isPending) return;
    startTransition(async () => {
      const res = paid ? await markUnpaid(id) : await markPaid(id);
      if (!res.ok) notifyDialog(res.error || "Erro");
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

  async function handleClick() {
    if (isPending) return;
    if (!(await confirmDialog("Apagar este extra?"))) return;
    startTransition(async () => {
      const res = await deleteExtra(id);
      if (!res.ok) notifyDialog(res.error || "Erro");
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label="Apagar extra"
      className="grid min-h-[40px] min-w-[36px] place-items-center rounded-lg px-2 text-sm text-danger hover:bg-danger-bg disabled:opacity-50"
    >
      {isPending ? "..." : "✕"}
    </button>
  );
}
