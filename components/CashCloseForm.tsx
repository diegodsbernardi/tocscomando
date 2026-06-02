"use client";

import { useMemo, useState } from "react";
import { CashCounter } from "./CashCounter";
import { brl } from "@/lib/format";

export function CashCloseForm({
  sessionId,
  openingAmount,
  inflows,
  outflows,
  action,
  suggestedCashSales,
  saiposCapturedAt,
}: {
  sessionId: string;
  openingAmount: number;
  inflows: number;
  outflows: number;
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
  suggestedCashSales?: number | null;
  saiposCapturedAt?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [vendas, setVendas] = useState<string>(
    suggestedCashSales != null ? String(suggestedCashSales) : "",
  );
  const [closingPreview, setClosingPreview] = useState<number>(0);

  const vendasNum = Number(vendas || 0);
  const expected = openingAmount + vendasNum + inflows - outflows;

  const diff = useMemo(() => {
    if (closingPreview <= 0) return null;
    return closingPreview - expected;
  }, [closingPreview, expected]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    fd.set("expected_amount", String(expected));
    const res = await action(fd);
    setSubmitting(false);
    if (res && !res.ok) setError(res.error || "Erro ao fechar caixa");
  }

  function onFormInput(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const v = Number(fd.get("closing_amount") || 0);
    if (v !== closingPreview) setClosingPreview(v);
  }

  return (
    <form
      onSubmit={onSubmit}
      onInput={onFormInput}
      className="space-y-4 rounded-card bg-white p-5 shadow-card"
    >
      <input type="hidden" name="id" value={sessionId} />

      {/* Resumo do que entra no esperado */}
      <div className="space-y-2 rounded-xl bg-line/60 p-3 text-sm">
        <Row label="Abertura" value={openingAmount} />
        <Row label="+ Entradas (reforços)" value={inflows} color="text-ok" />
        <Row label="− Saídas (sangrias)" value={outflows} color="text-danger" />
        <label className="flex items-center justify-between gap-3 pt-2">
          <span className="text-muted">
            + Vendas em dinheiro
            {suggestedCashSales != null && saiposCapturedAt && (
              <span className="ml-1.5 rounded-full bg-cyan/15 px-1.5 py-0.5 text-[10px] font-bold text-cyan">
                Saipos {new Date(saiposCapturedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </span>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0,00"
            value={vendas}
            onChange={(e) => setVendas(e.target.value)}
            className="w-32 rounded-lg border-[1.5px] border-line bg-white px-2 py-1.5 text-right font-bold tabular-nums focus:border-cyan focus:outline-none"
          />
        </label>
        <div className="flex items-center justify-between border-t border-line pt-2">
          <span className="font-bold text-navy">Esperado</span>
          <span className="font-display text-lg font-bold tabular-nums">{brl(expected)}</span>
        </div>
        <p className="text-[11px] text-muted">
          {suggestedCashSales != null
            ? "Valor sugerido pelo Saipos. Edita se precisar."
            : "Sem snapshot do Saipos ainda — lança manual."}
        </p>
      </div>

      <div>
        <span className="block text-sm font-bold text-navy">Valor contado</span>
        <p className="mb-2 text-[11px] text-muted">
          Conte a gaveta agora. Use o contador de notas/moedas pra evitar erro.
        </p>
        <CashCounter
          amountFieldName="closing_amount"
          breakdownFieldName="closing_breakdown"
        />
      </div>

      {diff !== null && (
        <div
          className={`rounded-2xl p-4 text-center ${
            Math.abs(diff) < 0.005
              ? "bg-ok-bg"
              : diff < 0
                ? "bg-danger-bg"
                : "bg-warn-bg"
          }`}
        >
          <div className="text-xs font-bold uppercase tracking-wider text-muted">
            Conferência
          </div>
          <div
            className={`mt-0.5 font-display text-2xl font-extrabold ${
              Math.abs(diff) < 0.005
                ? "text-ok"
                : diff < 0
                  ? "text-danger"
                  : "text-warn"
            }`}
          >
            {Math.abs(diff) < 0.005
              ? "Bateu ✓"
              : `${diff > 0 ? "+" : ""}${brl(diff)} ${diff > 0 ? "sobrou" : "faltou"}`}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            Esperado {brl(expected)} · Contado {brl(closingPreview)}
          </div>
        </div>
      )}

      <label className="flex flex-col text-sm font-bold text-navy">
        Observação (opcional)
        <input
          type="text"
          name="notes"
          maxLength={200}
          placeholder="ex: troco baixo, sobra na gaveta etc"
          className="mt-1 rounded-xl border-[1.5px] border-line px-3 py-2.5 text-sm focus:border-cyan focus:outline-none"
        />
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-brandyellow py-4 text-sm font-bold text-navy disabled:opacity-50"
      >
        {submitting ? "Fechando…" : "Fechar caixa"}
      </button>
    </form>
  );
}

function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`font-bold tabular-nums ${color || "text-navy"}`}>
        {brl(value)}
      </span>
    </div>
  );
}
