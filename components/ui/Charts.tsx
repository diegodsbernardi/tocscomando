/**
 * Gráficos puros em CSS — sem lib externa, sem client component.
 *  - BarChart: barras verticais (série temporal curta, até ~15 pontos)
 *  - BarList:  barras horizontais com rótulo e valor (rankings)
 */

export type Bar = { label: string; value: number; hint?: string; peak?: boolean };

export function BarChart({ bars, altura = 120 }: { bars: Bar[]; altura?: number }) {
  const max = Math.max(...bars.map((b) => b.value), 0);
  if (bars.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">Sem dados no período.</p>;
  }
  const compacto = bars.length > 10;
  return (
    <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div
        className="flex items-end gap-1.5"
        style={{ height: altura, minWidth: bars.length > 14 ? `${bars.length * 26}px` : undefined }}
      >
        {bars.map((b, i) => {
          const h = max > 0 ? (b.value / max) * 100 : 0;
          return (
            <div
              key={`${b.label}-${i}`}
              className="flex h-full min-w-[20px] flex-1 flex-col items-center justify-end gap-1"
              title={b.hint || `${b.label}: ${b.value}`}
            >
              {!compacto && (
                <span className="text-[10px] font-bold text-navy tabular-nums">{b.value}</span>
              )}
              <div
                className={`w-full min-h-[3px] rounded-t-[7px] rounded-b-[3px] transition-[height] duration-500 ease-out ${
                  b.peak ? "bg-brandyellow" : "bg-cyan"
                }`}
                style={{ height: `${h}%` }}
              />
              <span className="whitespace-nowrap text-[9px] font-semibold text-muted">
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BarList({ bars, sufixo = "" }: { bars: Bar[]; sufixo?: string }) {
  const max = Math.max(...bars.map((b) => b.value), 0);
  if (bars.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">Sem dados no período.</p>;
  }
  return (
    <div className="space-y-2">
      {bars.map((b, i) => {
        const w = max > 0 ? (b.value / max) * 100 : 0;
        return (
          <div key={`${b.label}-${i}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[13px] font-semibold text-navy">{b.label}</span>
              <span className="shrink-0 font-display text-[13px] font-bold tabular-nums text-navy">
                {b.value}
                {sufixo}
                {b.hint && <span className="ml-1 text-[11px] font-medium text-muted">{b.hint}</span>}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full ${b.peak ? "bg-brandyellow" : "bg-cyan"}`}
                style={{ width: `${w}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
