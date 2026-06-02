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
      className={`flex items-center justify-between gap-2 rounded-2xl p-3 shadow ${active ? "bg-white" : "bg-line"}`}
    >
      <p
        className={`min-w-0 flex-1 truncate text-sm font-semibold ${active ? "text-navy" : "text-muted line-through"}`}
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
            className="w-16 rounded-lg border border-line px-2 py-1 text-sm tabular-nums"
          />
          <button
            onClick={saveFee}
            disabled={isPending}
            className="rounded-lg bg-cyan px-2 py-1 text-xs font-semibold text-white hover:bg-cyan-deep disabled:opacity-50"
          >
            ✓
          </button>
          <button
            onClick={() => {
              setFee(String(initialFee));
              setEditing(false);
            }}
            className="rounded-lg bg-line px-2 py-1 text-xs"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg bg-line px-2 py-1 text-xs font-semibold tabular-nums text-navy hover:bg-line"
        >
          R$ {Number(initialFee).toFixed(2).replace(".", ",")}
        </button>
      )}
      <button
        onClick={toggle}
        disabled={isPending}
        className={`rounded-lg px-2 py-1 text-xs font-semibold disabled:opacity-50 ${
          active
            ? "bg-danger-bg text-danger hover:bg-danger-bg"
            : "bg-ok-bg text-ok hover:bg-ok-bg"
        }`}
      >
        {active ? "−" : "+"}
      </button>
    </article>
  );
}
