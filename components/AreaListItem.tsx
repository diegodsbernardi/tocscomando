"use client";

import { useState, useTransition } from "react";
import { toggleAreaActive, updateAreaFee } from "@/app/motoboys/actions";

export function AreaListItem({
  id,
  name,
  initialFee,
  active,
}: {
  id: string;
  name: string;
  initialFee: number;
  active: boolean;
}) {
  const [fee, setFee] = useState<string>(String(initialFee));
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function saveFee() {
    const n = Number(fee);
    if (!(n > 0)) {
      alert("Taxa precisa ser maior que zero");
      return;
    }
    startTransition(async () => {
      const res = await updateAreaFee(id, n);
      if (!res.ok) alert(res.error || "Erro");
      else setEditing(false);
    });
  }

  function toggle() {
    if (isPending) return;
    startTransition(async () => {
      const res = await toggleAreaActive(id, !active);
      if (!res.ok) alert(res.error || "Erro");
    });
  }

  return (
    <article
      className={`flex items-center justify-between gap-2 rounded-2xl p-3 shadow ${active ? "bg-white" : "bg-slate-100"}`}
    >
      <p
        className={`min-w-0 flex-1 truncate text-sm font-semibold ${active ? "text-slate-800" : "text-slate-500 line-through"}`}
      >
        {name}
      </p>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            type="number"
            step="0.5"
            min={0}
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm tabular-nums"
          />
          <button
            onClick={saveFee}
            disabled={isPending}
            className="rounded-lg bg-brand px-2 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            ✓
          </button>
          <button
            onClick={() => {
              setFee(String(initialFee));
              setEditing(false);
            }}
            className="rounded-lg bg-slate-200 px-2 py-1 text-xs"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold tabular-nums text-slate-700 hover:bg-slate-200"
        >
          R$ {Number(initialFee).toFixed(2).replace(".", ",")}
        </button>
      )}
      <button
        onClick={toggle}
        disabled={isPending}
        className={`rounded-lg px-2 py-1 text-xs font-semibold disabled:opacity-50 ${
          active
            ? "bg-red-100 text-red-700 hover:bg-red-200"
            : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
        }`}
      >
        {active ? "−" : "+"}
      </button>
    </article>
  );
}
