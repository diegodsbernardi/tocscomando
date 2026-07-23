"use client";

import { useOptimistic, useTransition } from "react";
import { toggleCheck } from "@/app/checklist/actions";
import { notifyDialog } from "@/components/ui/ConfirmDialog";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ChecklistItemRow({
  itemKey,
  label,
  doneByName,
  doneAt,
}: {
  itemKey: string;
  label: string;
  doneByName: string | null;
  doneAt: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimisticDone, setOptimisticDone] = useOptimistic(doneAt != null);

  function toggle() {
    if (isPending) return;
    const next = !optimisticDone;
    startTransition(async () => {
      setOptimisticDone(next);
      const res = await toggleCheck(itemKey, next);
      if (!res.ok) notifyDialog(res.error || "Erro");
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className="flex min-h-[52px] w-full items-center gap-3 rounded-card bg-white p-3 px-4 text-left shadow-card disabled:opacity-60"
    >
      <span
        className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg border-[2px] text-sm font-bold transition ${
          optimisticDone
            ? "border-ok bg-ok text-white"
            : "border-line bg-white text-transparent"
        }`}
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm font-semibold ${
            optimisticDone ? "text-muted line-through" : "text-navy"
          }`}
        >
          {label}
        </span>
        {optimisticDone && doneByName && doneAt && (
          <span className="text-[11px] text-muted">
            {doneByName} · {fmtTime(doneAt)}
          </span>
        )}
      </span>
    </button>
  );
}
