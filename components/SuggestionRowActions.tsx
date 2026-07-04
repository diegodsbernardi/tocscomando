"use client";

import { useTransition } from "react";
import { toggleSuggestionStatus, deleteSuggestion } from "@/app/sugestoes/actions";
import { confirmDialog, notifyDialog } from "@/components/ui/ConfirmDialog";

export function SuggestionStatusToggle({
  id,
  implemented,
}: {
  id: string;
  implemented: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    if (isPending) return;
    startTransition(async () => {
      const res = await toggleSuggestionStatus(id, !implemented);
      if (!res.ok) notifyDialog(res.error || "Erro");
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
        implemented ? "bg-ok-bg text-ok" : "bg-line text-muted"
      }`}
    >
      {isPending ? "..." : implemented ? "✓ Feita" : "Marcar feita"}
    </button>
  );
}

export function DeleteSuggestionButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  async function handleClick() {
    if (isPending) return;
    if (!(await confirmDialog("Apagar esta sugestão?"))) return;
    startTransition(async () => {
      const res = await deleteSuggestion(id);
      if (!res.ok) notifyDialog(res.error || "Erro");
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label="Apagar sugestão"
      className="grid min-h-[40px] min-w-[36px] place-items-center rounded-lg px-2 text-sm text-danger hover:bg-danger-bg disabled:opacity-50"
    >
      {isPending ? "..." : "✕"}
    </button>
  );
}
