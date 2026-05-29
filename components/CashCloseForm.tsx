"use client";

import { useMemo, useState } from "react";
import { CashCounter } from "./CashCounter";

function brl(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CashCloseForm({
  sessionId,
  openingAmount,
  action,
}: {
  sessionId: string;
  openingAmount: number;
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expected, setExpected] = useState<string>("");
  const [closingPreview, setClosingPreview] = useState<number>(0);

  const expectedNum = Number(expected || NaN);
  const diff = useMemo(() => {
    if (!Number.isFinite(expectedNum) || closingPreview <= 0) return null;
    return closingPreview - expectedNum;
  }, [expectedNum, closingPreview]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await action(new FormData(e.currentTarget));
    setSubmitting(false);
    if (res && !res.ok) setError(res.error || "Erro ao fechar caixa");
  }

  // Lê valor hidden gerado pelo CashCounter (para preview em tempo real)
  function onFormInput(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const v = Number(fd.get("closing_amount") || 0);
    if (v !== closingPreview) setClosingPreview(v);
  }

  return (
    <form
      onSubmit={onSubmit}
      onInput={onFormInput}
      className="space-y-4 rounded-2xl bg-white p-5 shadow"
    >
      <input type="hidden" name="id" value={sessionId} />

      <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Abertura
          </span>
          <span className="text-base font-semibold tabular-nums">{brl(openingAmount)}</span>
        </div>
      </div>

      <div>
        <span className="block text-sm font-medium text-slate-700">Valor de fechamento</span>
        <p className="mb-2 text-[11px] text-slate-500">
          Conte o caixa agora. Pode usar o contador de notas/moedas.
        </p>
        <CashCounter
          amountFieldName="closing_amount"
          breakdownFieldName="closing_breakdown"
        />
      </div>

      <label className="flex flex-col text-sm font-medium text-slate-700">
        Saldo esperado (opcional)
        <input
          type="number"
          name="expected_amount"
          step="0.01"
          inputMode="decimal"
          placeholder="Ex: total do Saipos + abertura"
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
        <span className="mt-1 text-[11px] text-slate-500">
          Se preencher, o sistema calcula a diferença de caixa.
        </span>
      </label>

      {diff !== null && (
        <div
          className={`rounded-lg p-3 text-sm font-semibold ${
            diff === 0
              ? "bg-emerald-50 text-emerald-700"
              : diff < 0
                ? "bg-red-50 text-red-700"
                : "bg-amber-50 text-amber-700"
          }`}
        >
          Diferença: {diff > 0 ? "+" : ""}
          {brl(diff)}
          {diff === 0 && " · caixa bate certinho"}
          {diff < 0 && " · falta dinheiro"}
          {diff > 0 && " · sobra dinheiro"}
        </div>
      )}

      <label className="flex flex-col text-sm font-medium text-slate-700">
        Observação (opcional)
        <input
          type="text"
          name="notes"
          maxLength={200}
          placeholder="Ex: cliente pagou em moeda, troco pra próxima etc"
          className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-brand py-3 text-sm font-semibold text-white shadow hover:bg-brand-dark disabled:opacity-50"
      >
        {submitting ? "Fechando…" : "Fechar caixa"}
      </button>
    </form>
  );
}
