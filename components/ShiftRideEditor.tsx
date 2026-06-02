"use client";

import { useMemo, useState, useTransition } from "react";
import { updateShiftRide } from "@/app/motoboys/actions";

export type Area = { id: string; name: string; fee: number };
export type ExistingRide = { area_id: string; rides_count: number; fee_at_time: number };

const MIN_DAILY_PAYMENT = 100;

function brl(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ShiftRideEditor({
  shiftId,
  areas,
  initialRides,
}: {
  shiftId: string;
  areas: Area[];
  initialRides: ExistingRide[];
}) {
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const r of initialRides) m[r.area_id] = r.rides_count;
    return m;
  });
  const [, startTransition] = useTransition();
  const [savingArea, setSavingArea] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const total = useMemo(
    () => areas.reduce((acc, a) => acc + (counts[a.id] || 0) * Number(a.fee), 0),
    [areas, counts],
  );
  const totalRides = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts],
  );
  const effective = Math.max(total, MIN_DAILY_PAYMENT);
  const belowMin = total < MIN_DAILY_PAYMENT;

  function commit(areaId: string, value: number) {
    setSavingArea(areaId);
    startTransition(async () => {
      const res = await updateShiftRide(shiftId, areaId, value);
      setSavingArea((cur) => (cur === areaId ? null : cur));
      if (!res.ok) alert(res.error || "Erro ao salvar");
    });
  }

  function changeBy(areaId: string, delta: number) {
    setCounts((prev) => {
      const next = Math.max(0, (prev[areaId] || 0) + delta);
      commit(areaId, next);
      return { ...prev, [areaId]: next };
    });
  }

  function setRaw(areaId: string, valueStr: string) {
    const n = Math.max(0, parseInt(valueStr || "0", 10) || 0);
    setCounts((prev) => {
      commit(areaId, n);
      return { ...prev, [areaId]: n };
    });
  }

  // Filtra bairros pelo input
  const filteredAreas = useMemo(() => {
    if (!filter.trim()) {
      // Ordena: primeiro os com count > 0, depois por taxa asc, depois por nome
      return [...areas].sort((a, b) => {
        const ac = counts[a.id] || 0;
        const bc = counts[b.id] || 0;
        if (ac > 0 && bc === 0) return -1;
        if (bc > 0 && ac === 0) return 1;
        if (a.fee !== b.fee) return Number(a.fee) - Number(b.fee);
        return a.name.localeCompare(b.name, "pt-BR");
      });
    }
    const q = filter.toLowerCase().trim();
    return areas
      .filter((a) => a.name.toLowerCase().includes(q))
      .sort((a, b) => Number(a.fee) - Number(b.fee));
  }, [areas, counts, filter]);

  return (
    <div className="space-y-4">
      {/* Total */}
      <section className="rounded-2xl bg-cyan-hero p-5 text-white shadow-glow">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
            Total
          </span>
          <span className="text-xs text-white/80">
            {totalRides} {totalRides === 1 ? "corrida" : "corridas"}
          </span>
        </div>
        <p className="mt-1 text-3xl font-bold tabular-nums">{brl(effective)}</p>
        {belowMin && (
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-brandyellow">
            Abaixo do mínimo. Corridas: {brl(total)} · Mínimo: {brl(MIN_DAILY_PAYMENT)}
          </p>
        )}
      </section>

      {/* Filtro */}
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar bairro…"
        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
      />

      {/* Lista de bairros */}
      <div className="space-y-1 rounded-2xl bg-white p-2 shadow">
        {filteredAreas.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">Nenhum bairro encontrado.</p>
        )}
        {filteredAreas.map((a) => {
          const c = counts[a.id] || 0;
          const sub = c * Number(a.fee);
          const isSaving = savingArea === a.id;
          return (
            <div
              key={a.id}
              className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${c > 0 ? "bg-cyan/5" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-navy">{a.name}</p>
                <p className="text-[11px] text-muted tabular-nums">{brl(Number(a.fee))}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => changeBy(a.id, -1)}
                  disabled={c === 0}
                  className="h-8 w-8 rounded-lg bg-line text-base text-navy hover:bg-line disabled:opacity-30"
                  aria-label={`Diminuir ${a.name}`}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={c}
                  onChange={(e) => setRaw(a.id, e.target.value)}
                  className="w-12 rounded-lg border border-line px-1 py-1 text-center text-sm tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => changeBy(a.id, +1)}
                  className="h-8 w-8 rounded-lg bg-cyan text-base font-bold text-white hover:bg-cyan-deep"
                  aria-label={`Adicionar ${a.name}`}
                >
                  +
                </button>
              </div>
              <span
                className={`w-16 text-right text-sm tabular-nums ${c > 0 ? "font-semibold text-navy" : "text-muted"}`}
              >
                {brl(sub)}
                {isSaving && <span className="ml-1 text-[10px] text-muted">…</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
