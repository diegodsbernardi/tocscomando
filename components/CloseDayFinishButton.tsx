"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { closeDay } from "@/app/fechar-o-dia/actions";
import { notifyDialog } from "@/components/ui/ConfirmDialog";

export function CloseDayFinishButton() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function finish() {
    if (done || isPending) return;
    startTransition(async () => {
      const res = await closeDay();
      if (!res.ok) {
        notifyDialog(res.error || "Erro ao fechar o dia");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/"), 800);
    });
  }

  return (
    <button
      onClick={finish}
      disabled={done || isPending}
      className="flex-1 rounded-xl bg-brandyellow py-3.5 text-[15px] font-bold text-navy disabled:opacity-70"
    >
      {isPending ? "Fechando..." : done ? "✓ Dia fechado" : "Concluir"}
    </button>
  );
}
