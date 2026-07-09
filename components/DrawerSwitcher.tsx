"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setMyDrawer } from "@/app/perfil/actions";
import { notifyDialog } from "@/components/ui/ConfirmDialog";

type Drawer = { id: string; name: string };

const LABEL: Record<string, string> = { DLV: "Delivery", LTDA: "Salão" };

/**
 * Seletor "onde eu estou trabalhando hoje" — troca o caixa do próprio usuário
 * e com isso o escopo do app inteiro (caixa visível, aba Motoboys, fechamento).
 */
export function DrawerSwitcher({
  drawers,
  currentDrawerId,
}: {
  drawers: Drawer[];
  currentDrawerId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function pick(id: string) {
    if (isPending || id === currentDrawerId) return;
    startTransition(async () => {
      const res = await setMyDrawer(id);
      if (!res.ok) {
        notifyDialog(res.error || "Erro ao trocar de loja");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-4 mt-3 flex items-center gap-2 rounded-card bg-white p-2 px-3 shadow-card">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
        Estou no:
      </span>
      <div className="flex flex-1 gap-1.5">
        {drawers.map((d) => {
          const active = d.id === currentDrawerId;
          return (
            <button
              key={d.id}
              onClick={() => pick(d.id)}
              disabled={isPending}
              className={`min-h-[40px] flex-1 rounded-xl border-[1.5px] text-xs font-bold transition disabled:opacity-60 ${
                active
                  ? "border-navy bg-navy text-white"
                  : "border-line bg-white text-muted"
              }`}
            >
              {isPending && !active ? "..." : LABEL[d.name] || d.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
