"use client";

import { useMemo, useState, useTransition } from "react";
import { saveShiftRides } from "@/app/motoboys/actions";

export type Area = { id: string; name: string; fee: number };
export type ExistingRide = { area_id: string; rides_count: number; fee_at_time: number };

const MIN_DAILY_PAYMENT = 100;

function brl(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildInitial(initialRides: ExistingRide[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of initialRides) m[r.area_id] = r.rides_count;
  return m;
}

function isDirty(
  current: Record<string, number>,
  baseline: Record<string, number>,
): boolean {
  const keys = new Set([...Object.keys(current), ...Object.keys(baseline)]);
  for (const k of keys) {
    const a = current[k] || 0;
    const b = baseline[k] || 0;
    if (a !== b) return true;
  }
  return false;
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
  // Estado local: counts atuais (editados) + baseline (último estado salvo)
  const [counts, setCounts] = useState<Record<string, number>>(() => buildInitial(initialRides));
  const [baseline, setBaseline] = useState<Record<string, number>>(() => buildInitial(initialRides));
  const [filter, setFilter] = useState("");
  const [savingState, startSaveTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
  const dirty = useMemo(() => isDirty(counts, baseline), [counts, baseline]);
  const dirtyAreaIds = useMemo(() => {
    const ids: string[] = [];
    const keys = new Set([...Object.keys(counts), ...Object.keys(baseline)]);
    for (const k of keys) {
      const a = counts[k] || 0;
      const b = baseline[k] || 0;
      if (a !== b) ids.push(k);
    }
    return ids;
  }, [counts, baseline]);

  function changeBy(areaId: string, delta: number) {
    setError(null);
    setCounts((prev) => ({
      ...prev,
      [areaId]: Math.max(0, (prev[areaId] || 0) + delta),
    }));
  }

  function setRaw(areaId: string, valueStr: string) {
    setError(null);
    const n = Math.max(0, parseInt(valueStr || "0", 10) || 0);
    setCounts((prev) => ({ ...prev, [areaId]: n }));
  }

  function discardChanges() {
    setCounts(baseline);
    setError(null);
  }

  function save() {
    if (!dirty || savingState) return;
    setError(null);
    // Envia só o que mudou — menor payload + servidor faz upsert/delete certinho
    const payload: Record<string, number> = {};
    for (const id of dirtyAreaIds) payload[id] = counts[id] || 0;

    startSaveTransition(async () => {
      const res = await saveShiftRides(shiftId, payload);
      if (!res.ok) {
        setError(res.error || "Erro ao salvar");
        return;
      }
      // Sucesso: novo baseline = counts atual
      setBaseline({ ...counts });
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
    <div className="space-y-4 pb-32">
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

      <p className="px-1 text-[12px] leading-snug text-muted">
        Conta tudo e clica em <b className="text-navy">Salvar corridas</b> embaixo. Pode digitar o número direto ou usar +/−.
      </p>

      {/* Lista de bairros */}
      <div className="space-y-1 rounded-2xl bg-white p-2 shadow">
        {filteredAreas.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">Nenhum bairro encontrado.</p>
        )}
        {filteredAreas.map((a) => {
          const c = counts[a.id] || 0;
          const sub = c * Number(a.fee);
          const wasZero = (baseline[a.id] || 0) === 0;
          const isNew = c > 0 && wasZero;
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
                  className="h-8 w-8 rounded-lg bg-line text-base text-navy disabled:opacity-30"
                  aria-label={`Diminuir ${a.name}`}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={c === 0 ? "" : c}
                  placeholder="0"
                  onChange={(e) => setRaw(a.id, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-14 rounded-lg border border-line px-1 py-1.5 text-center text-sm tabular-nums focus:border-cyan focus:outline-none"
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
                {isNew && <span className="ml-1 text-[10px] font-bold text-cyan">•</span>}
              </span>
            </div>
          );
        })}
      </div>

      {/* Sticky bar com salvar */}
      <div className="fixed bottom-[88px] left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
        {error && (
          <p className="mb-2 text-center text-xs font-semibold text-danger">{error}</p>
        )}
        <div className="flex items-center gap-2">
          {dirty && !savingState && (
            <button
              type="button"
              onClick={discardChanges}
              className="rounded-xl bg-line px-3 py-3 text-xs font-semibold text-muted"
            >
              Desfazer
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || savingState}
            className={`flex-1 rounded-xl py-3 text-sm font-bold transition disabled:opacity-50 ${
              dirty
                ? "bg-cyan text-white"
                : "bg-line text-muted"
            }`}
          >
            {savingState
              ? "Salvando…"
              : dirty
                ? `Salvar corridas (${totalRides})`
                : "Tudo salvo ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}
