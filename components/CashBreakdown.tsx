import { brl } from "@/lib/format";

export type Breakdown = Record<string, number> | null;

function denomLabel(v: number) {
  return v >= 2
    ? `R$ ${v}`
    : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Detalhe expansível (<details>) com a contagem por cédula/moeda salva
 * em opening_breakdown / closing_breakdown de cash_sessions.
 */
export function CashBreakdownDetails({
  breakdown,
  label,
}: {
  breakdown: Breakdown;
  label: string;
}) {
  if (!breakdown) return null;
  const rows = Object.entries(breakdown)
    .map(([k, q]) => ({ v: Number(k), q: Number(q) }))
    .filter((r) => r.q > 0 && Number.isFinite(r.v))
    .sort((a, b) => b.v - a.v);
  if (rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + r.v * r.q, 0);

  return (
    <details className="group mt-1">
      <summary className="flex min-h-[40px] cursor-pointer list-none items-center gap-1 py-1 text-[11px] font-semibold text-cyan [&::-webkit-details-marker]:hidden">
        <span className="transition-transform group-open:rotate-90">▸</span>
        {label}
      </summary>
      <div className="mt-1 rounded-lg bg-appbg p-2">
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li
              key={r.v}
              className="flex items-center justify-between py-1 text-xs text-navy"
            >
              <span className="tabular-nums">
                {r.q}× {denomLabel(r.v)}
              </span>
              <span className="tabular-nums text-muted">{brl(r.v * r.q)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-1 flex items-center justify-between border-t border-line pt-1 text-xs font-bold text-navy">
          <span>Total contado</span>
          <span className="tabular-nums">{brl(total)}</span>
        </div>
      </div>
    </details>
  );
}
