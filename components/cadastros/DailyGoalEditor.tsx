"use client";

import { useState, useTransition } from "react";
import { updateDailyRevenueGoal } from "@/app/cadastros/actions";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function DailyGoalEditor({ initialGoal }: { initialGoal: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(initialGoal));
  const [savedGoal, setSavedGoal] = useState(initialGoal);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("goal", value);
      const res = await updateDailyRevenueGoal(fd);
      if (!res.ok) setError(res.error || "Erro");
      else {
        setSavedGoal(Number(value.replace(",", ".")));
        setEditing(false);
      }
    });
  }

  return (
    <article className="rounded-card bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <strong className="block text-[15px] font-bold">Meta diária</strong>
          <small className="block text-[11px] text-muted">
            Faturamento alvo · aparece na home
          </small>
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-28 rounded-lg border-[1.5px] border-line px-2 py-1.5 text-right font-bold tabular-nums focus:border-cyan focus:outline-none"
            />
            <button
              onClick={save}
              disabled={isPending}
              className="rounded-lg bg-cyan px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              ✓
            </button>
            <button
              onClick={() => {
                setValue(String(savedGoal));
                setEditing(false);
                setError(null);
              }}
              className="rounded-lg bg-line px-2 py-1.5 text-xs"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg bg-line px-3 py-1.5 text-xs font-bold tabular-nums text-navy"
          >
            {brl(savedGoal)}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </article>
  );
}
