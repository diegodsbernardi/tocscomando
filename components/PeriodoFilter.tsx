import Link from "next/link";
import { PRESETS, type Periodo, type PeriodoKey } from "@/lib/periodo";

/**
 * Chips de período + intervalo manual. Sem JS: os chips são links e o
 * intervalo é um <form method="get">, que o Next resolve como navegação.
 *
 * `extras` são os outros filtros da tela (ex: centro de custo) que precisam
 * sobreviver à troca de período.
 */
export function PeriodoFilter({
  periodo,
  extras = {},
  basePath,
}: {
  periodo: Periodo;
  extras?: Record<string, string | undefined>;
  basePath?: string;
}) {
  const href = (key: PeriodoKey) => {
    const sp = new URLSearchParams();
    sp.set("p", key);
    for (const [k, v] of Object.entries(extras)) if (v) sp.set(k, v);
    return `${basePath ?? ""}?${sp.toString()}`;
  };

  return (
    <div className="reveal d2">
      <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2">
          {PRESETS.map(([key, label]) => (
            <Link
              key={key}
              href={href(key)}
              className={`whitespace-nowrap rounded-xl border-[1.5px] px-3.5 py-2 text-[13px] font-bold transition ${
                periodo.key === key
                  ? "border-navy bg-navy text-white"
                  : "border-line bg-white text-muted"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <form
        method="get"
        action={basePath}
        className="mt-2 flex items-end gap-2 rounded-card bg-white p-3 shadow-card"
      >
        <input type="hidden" name="p" value="custom" />
        {Object.entries(extras).map(([k, v]) =>
          v ? <input key={k} type="hidden" name={k} value={v} /> : null,
        )}
        <label className="flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-[0.5px] text-muted">
            De
          </span>
          <input
            type="date"
            name="de"
            defaultValue={periodo.start}
            className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-2 py-2 text-[13px] font-semibold text-navy"
          />
        </label>
        <label className="flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-[0.5px] text-muted">
            Até
          </span>
          <input
            type="date"
            name="ate"
            defaultValue={periodo.end}
            className="mt-1 w-full rounded-lg border-[1.5px] border-line bg-white px-2 py-2 text-[13px] font-semibold text-navy"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-brandyellow px-4 py-2.5 text-[13px] font-bold text-navy"
        >
          Ver
        </button>
      </form>
    </div>
  );
}
