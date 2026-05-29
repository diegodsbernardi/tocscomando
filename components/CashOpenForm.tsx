"use client";

import { useState } from "react";
import { CashCounter } from "./CashCounter";

type Drawer = { id: string; name: string };

export function CashOpenForm({
  drawers,
  preselectedDrawerId,
  action,
}: {
  drawers: Drawer[];
  preselectedDrawerId: string;
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await action(new FormData(e.currentTarget));
    setSubmitting(false);
    if (res && !res.ok) setError(res.error || "Erro ao abrir caixa");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow">
      <label className="flex flex-col text-sm font-medium text-slate-700">
        Caixa
        <select
          name="drawer_id"
          required
          defaultValue={preselectedDrawerId}
          className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-base"
        >
          {drawers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="block text-sm font-medium text-slate-700">Valor de abertura</span>
        <p className="mb-2 text-[11px] text-slate-500">
          Quanto tem no caixa agora. Use o contador pra evitar erro de soma.
        </p>
        <CashCounter
          amountFieldName="opening_amount"
          breakdownFieldName="opening_breakdown"
        />
      </div>

      <label className="flex flex-col text-sm font-medium text-slate-700">
        Observação (opcional)
        <input
          type="text"
          name="notes"
          maxLength={200}
          placeholder="Ex: troco baixo, falta moeda etc"
          className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-brand py-3 text-sm font-semibold text-white shadow hover:bg-brand-dark disabled:opacity-50"
      >
        {submitting ? "Abrindo…" : "Abrir caixa"}
      </button>
    </form>
  );
}
