"use client";

import { useTransition } from "react";
import { toggleEmployeeActive } from "@/app/extras/funcionarios/actions";

export function EmployeeListItem({
  id,
  name,
  centro,
  active,
}: {
  id: string;
  name: string;
  centro: "atendimento" | "cozinha";
  active: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    if (isPending) return;
    startTransition(async () => {
      const res = await toggleEmployeeActive(id, !active);
      if (!res.ok) alert(res.error || "Erro");
    });
  }

  return (
    <article
      className={`flex items-center justify-between gap-3 rounded-2xl p-3 shadow ${
        active ? "bg-white" : "bg-line"
      }`}
    >
      <div>
        <p className={`text-sm font-semibold ${active ? "text-navy" : "text-muted line-through"}`}>
          {name}
        </p>
        <p className="text-[11px] text-muted">
          {centro === "atendimento" ? "Atendimento" : "Cozinha"}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={isPending}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
          active
            ? "bg-danger-bg text-danger hover:bg-danger-bg"
            : "bg-ok-bg text-ok hover:bg-ok-bg"
        }`}
      >
        {isPending ? "..." : active ? "Desativar" : "Reativar"}
      </button>
    </article>
  );
}
