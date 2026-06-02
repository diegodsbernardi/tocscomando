"use client";

import { useEffect, useMemo, useState } from "react";

const DENOMS = [
  { v: 200, kind: "nota", label: "R$ 200" },
  { v: 100, kind: "nota", label: "R$ 100" },
  { v: 50, kind: "nota", label: "R$ 50" },
  { v: 20, kind: "nota", label: "R$ 20" },
  { v: 10, kind: "nota", label: "R$ 10" },
  { v: 5, kind: "nota", label: "R$ 5" },
  { v: 2, kind: "nota", label: "R$ 2" },
  { v: 1, kind: "moeda", label: "R$ 1,00" },
  { v: 0.5, kind: "moeda", label: "R$ 0,50" },
  { v: 0.25, kind: "moeda", label: "R$ 0,25" },
  { v: 0.1, kind: "moeda", label: "R$ 0,10" },
  { v: 0.05, kind: "moeda", label: "R$ 0,05" },
] as const;

function brl(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Props = {
  /** Nome dos campos hidden que vão pro form */
  amountFieldName: string;
  breakdownFieldName: string;
  /** Valores iniciais (re-edição) */
  initialBreakdown?: Record<string, number> | null;
  initialAmount?: number | null;
};

export function CashCounter({
  amountFieldName,
  breakdownFieldName,
  initialBreakdown,
  initialAmount,
}: Props) {
  const [useCounter, setUseCounter] = useState<boolean>(!!initialBreakdown);
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const d of DENOMS) init[String(d.v)] = initialBreakdown?.[String(d.v)] ?? 0;
    return init;
  });
  const [manualAmount, setManualAmount] = useState<string>(
    initialAmount != null ? String(initialAmount) : "",
  );

  const counterTotal = useMemo(
    () => DENOMS.reduce((sum, d) => sum + d.v * (counts[String(d.v)] || 0), 0),
    [counts],
  );

  const amount = useCounter ? counterTotal : Number(manualAmount || 0);

  const breakdownValue = useCounter
    ? JSON.stringify(
        Object.fromEntries(
          Object.entries(counts).filter(([, q]) => q > 0).map(([k, q]) => [k, q]),
        ),
      )
    : "";

  // Pre-fill manual amount from breakdown total when toggling off
  useEffect(() => {
    if (!useCounter && initialAmount == null && counterTotal > 0 && !manualAmount) {
      setManualAmount(String(counterTotal));
    }
  }, [useCounter, counterTotal, manualAmount, initialAmount]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg bg-line p-2">
        <label className="flex items-center gap-2 text-sm font-medium text-navy">
          <input
            type="checkbox"
            checked={useCounter}
            onChange={(e) => setUseCounter(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          Contar por notas e moedas
        </label>
      </div>

      {useCounter ? (
        <div className="rounded-2xl bg-white p-3 shadow-inner">
          <div className="grid grid-cols-1 divide-y divide-line">
            {DENOMS.map((d) => {
              const q = counts[String(d.v)] || 0;
              const sub = d.v * q;
              return (
                <div
                  key={d.v}
                  className="flex items-center justify-between gap-2 py-1.5"
                >
                  <span className="w-20 text-sm font-medium text-navy">
                    {d.label}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted">
                    {d.kind}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCounts({ ...counts, [String(d.v)]: Math.max(0, q - 1) })
                      }
                      className="h-7 w-7 rounded-lg bg-line text-navy hover:bg-line"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={q}
                      onChange={(e) =>
                        setCounts({
                          ...counts,
                          [String(d.v)]: Math.max(0, parseInt(e.target.value || "0", 10) || 0),
                        })
                      }
                      className="w-14 rounded-lg border border-line px-2 py-1 text-center text-sm tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => setCounts({ ...counts, [String(d.v)]: q + 1 })}
                      className="h-7 w-7 rounded-lg bg-line text-navy hover:bg-line"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-20 text-right text-sm tabular-nums text-navy">
                    {brl(sub)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-base font-semibold text-cyan">
            <span>Total contado</span>
            <span className="tabular-nums">{brl(counterTotal)}</span>
          </div>
        </div>
      ) : (
        <input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          placeholder="0,00"
          value={manualAmount}
          onChange={(e) => setManualAmount(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-3 text-lg font-semibold tabular-nums"
        />
      )}

      <input type="hidden" name={amountFieldName} value={amount.toFixed(2)} />
      <input type="hidden" name={breakdownFieldName} value={breakdownValue} />
    </div>
  );
}
