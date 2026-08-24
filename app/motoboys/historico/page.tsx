import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { BarChart, BarList, type Bar } from "@/components/ui/Charts";
import { brl } from "@/lib/format";
import { aggregate, statsFromShift, verdictFor, type RawShift, type ShiftStats } from "@/lib/motoboys-stats";
import { fmtDiaCurto, listarDias, resolverPeriodo } from "@/lib/periodo";
import { canSeeMotoboys, getCurrentProfile } from "@/lib/profile";
import { DataErrorCard } from "@/components/ui/DataErrorCard";

export const dynamic = "force-dynamic";

const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

type RideRow = {
  rides_count: number;
  fee_at_time: number;
  delivery_areas: { name: string } | null;
};

export default async function HistoricoEntregasPage({
  searchParams,
}: {
  searchParams: { p?: string; de?: string; ate?: string; corte?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  if (!canSeeMotoboys(profile)) redirect("/");

  const periodo = resolverPeriodo(searchParams);

  const { data, error } = await supabase
    .from("motoboy_shifts")
    .select(
      "id, work_date, motoboy_id, paid, motoboys(name), motoboy_shift_rides(rides_count, fee_at_time, delivery_areas(name))",
    )
    .gte("work_date", periodo.start)
    .lte("work_date", periodo.end)
    .order("work_date");

  const linhas = ((data || []) as unknown as Array<{
    id: string;
    work_date: string;
    motoboy_id: string;
    paid: boolean;
    motoboys: { name: string } | null;
    motoboy_shift_rides: RideRow[];
  }>);

  const rawShifts = linhas.map<RawShift>((s) => ({
    id: s.id,
    work_date: s.work_date,
    motoboy_id: s.motoboy_id,
    motoboys: s.motoboys,
    rides: s.motoboy_shift_rides || [],
  }));

  const shifts: ShiftStats[] = rawShifts.map(statsFromShift);
  const agg = aggregate(shifts);
  const verdict = verdictFor(agg, periodo.dias <= 1 ? "dia" : periodo.dias <= 8 ? "semana" : "mes");

  const naoPagos = linhas.filter((s) => !s.paid);
  const totalNaoPago = naoPagos.reduce((acc, s) => {
    const bruto = (s.motoboy_shift_rides || []).reduce(
      (a, r) => a + Number(r.rides_count) * Number(r.fee_at_time),
      0,
    );
    return acc + Math.max(bruto, 100);
  }, 0);

  // ---- Corte 1: corridas por dia ----------------------------------------
  const porDiaMap = new Map<string, number>();
  for (const s of shifts) porDiaMap.set(s.workDate, (porDiaMap.get(s.workDate) ?? 0) + s.rides);
  const maxDia = Math.max(...porDiaMap.values(), 0);
  const barsDia: Bar[] = listarDias(periodo).map((d) => {
    const v = porDiaMap.get(d) ?? 0;
    const dow = DOW[new Date(`${d}T12:00:00`).getDay()];
    return {
      label: periodo.dias > 12 ? fmtDiaCurto(d).slice(0, 5) : `${fmtDiaCurto(d).slice(0, 5)}\n${dow}`,
      value: v,
      hint: `${fmtDiaCurto(d)} (${dow}): ${v} corridas`,
      peak: v > 0 && v === maxDia,
    };
  });

  // ---- Corte 2: por motoboy --------------------------------------------
  const porMoto = new Map<
    string,
    { nome: string; corridas: number; pago: number; piso: number; dias: number }
  >();
  for (const s of shifts) {
    const cur = porMoto.get(s.motoboyId) ?? {
      nome: s.motoboyName,
      corridas: 0,
      pago: 0,
      piso: 0,
      dias: 0,
    };
    cur.corridas += s.rides;
    cur.pago += s.effective;
    cur.piso += Math.max(0, s.effective - s.raw);
    cur.dias += 1;
    porMoto.set(s.motoboyId, cur);
  }
  const motos = Array.from(porMoto.values()).sort((a, b) => b.corridas - a.corridas);
  const barsMoto: Bar[] = motos.map((m, i) => ({
    label: m.nome.split(" ")[0],
    value: m.corridas,
    hint: `${(m.corridas / m.dias).toFixed(1)} corridas/dia · ${brl(m.pago)}`,
    peak: i === 0,
  }));

  // ---- Corte 3: por bairro ---------------------------------------------
  const porBairro = new Map<string, { corridas: number; valor: number }>();
  for (const s of linhas) {
    for (const r of s.motoboy_shift_rides || []) {
      const n = Number(r.rides_count);
      if (n <= 0) continue;
      const nome = r.delivery_areas?.name || "—";
      const cur = porBairro.get(nome) ?? { corridas: 0, valor: 0 };
      cur.corridas += n;
      cur.valor += n * Number(r.fee_at_time);
      porBairro.set(nome, cur);
    }
  }
  const bairros = Array.from(porBairro.entries())
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.corridas - a.corridas);
  const barsBairro: Bar[] = bairros.slice(0, 12).map((b, i) => ({
    label: b.nome,
    value: b.corridas,
    hint: brl(b.valor),
    peak: i === 0,
  }));

  const corte = (searchParams.corte === "bairro" || searchParams.corte === "moto"
    ? searchParams.corte
    : "dia") as "dia" | "moto" | "bairro";

  const qsBase = new URLSearchParams();
  qsBase.set("p", periodo.key);
  if (periodo.key === "custom") {
    qsBase.set("de", periodo.start);
    qsBase.set("ate", periodo.end);
  }
  const corteHref = (c: string) => {
    const sp = new URLSearchParams(qsBase);
    sp.set("corte", c);
    return `?${sp.toString()}`;
  };

  const mediaDiaria = periodo.dias > 0 ? agg.totalRides / periodo.dias : 0;

  return (
    <Shell>
      <TopBar
        title="Entregas · Relatório"
        subtitle="corridas, motos e bairros"
        backHref="/motoboys"
      />

      <div className="px-4">
        <PeriodoFilter periodo={periodo} extras={{ corte }} />

        {/* Hero */}
        <section className="relative mt-3 overflow-hidden rounded-hero p-5 px-5 text-white shadow-glow bg-cyan-hero reveal d2">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"
          />
          <div className="text-xs font-semibold tracking-[0.5px] opacity-85">
            {periodo.titulo} · {periodo.label}
          </div>
          <div className="mt-0.5 font-display text-[40px] font-extrabold leading-none tracking-[-1px]">
            {agg.totalRides} corridas
          </div>
          <div className="mt-1 text-[13px] opacity-90">
            {agg.totalMotos} {agg.totalMotos === 1 ? "moto" : "motos"} · {shifts.length} turnos ·{" "}
            {brl(agg.totalPago)} em entregas
          </div>
        </section>

        {/* Mini cards */}
        <div className="mt-3 flex gap-2.5 reveal d3">
          <MiniCard
            label="Corridas por dia"
            value={agg.totalRides > 0 ? mediaDiaria.toFixed(1) : "—"}
            hint={`${periodo.dias} ${periodo.dias === 1 ? "dia" : "dias"}`}
          />
          <MiniCard
            label="Custo por corrida"
            value={agg.totalRides > 0 ? brl(agg.custoPorCorrida) : "—"}
            hint="total ÷ corridas"
          />
          <MiniCard
            label="Pago no piso"
            value={brl(agg.totalPiso)}
            hint="moto sobrando"
            warn={agg.totalPiso > 0}
          />
        </div>

        {/* Corte do gráfico */}
        <div className="mt-4 flex gap-2 reveal d3">
          <SegBtn href={corteHref("dia")} label="Por dia" active={corte === "dia"} />
          <SegBtn href={corteHref("moto")} label="Por moto" active={corte === "moto"} />
          <SegBtn href={corteHref("bairro")} label="Por bairro" active={corte === "bairro"} />
        </div>

        <section className="mt-3 rounded-card bg-white p-4 shadow-card reveal d4">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.5px] text-muted">
            {corte === "dia"
              ? "Corridas por dia"
              : corte === "moto"
                ? "Corridas por motoboy"
                : `Corridas por bairro · top ${barsBairro.length} de ${bairros.length}`}
          </div>
          {error && <DataErrorCard />}
          {!error && corte === "dia" && <BarChart bars={barsDia} />}
          {!error && corte === "moto" && <BarList bars={barsMoto} />}
          {!error && corte === "bairro" && <BarList bars={barsBairro} />}
        </section>

        {/* Verdict */}
        {shifts.length > 0 && (
          <section
            className={`mt-3 flex items-start gap-3 rounded-card p-4 reveal d4 ${
              verdict.tone === "ok" ? "bg-ok-bg" : "bg-warn-bg"
            }`}
          >
            <span className="text-lg">{verdict.tone === "ok" ? "✅" : "💡"}</span>
            <p
              className={`text-[13px] font-semibold leading-snug ${
                verdict.tone === "ok" ? "text-ok" : "text-warn"
              }`}
            >
              {verdict.text}
            </p>
          </section>
        )}

        {totalNaoPago > 0 && (
          <section className="mt-3 flex items-start gap-3 rounded-card bg-warn-bg p-4 reveal d4">
            <span className="text-lg">⚠️</span>
            <p className="text-[13px] font-semibold leading-snug text-warn">
              {naoPagos.length} turno{naoPagos.length > 1 ? "s" : ""} sem baixa no período —{" "}
              {brl(totalNaoPago)} em aberto.
            </p>
          </section>
        )}

        {/* Fechamento por motoboy */}
        <h3 className="mb-2 mt-5 px-1 text-[11px] font-bold uppercase tracking-[0.5px] text-muted">
          Fechamento por motoboy
        </h3>
        <div className="space-y-2 reveal d5">
          {motos.length === 0 && (
            <p className="rounded-card bg-white p-6 text-center text-sm text-muted shadow-card">
              Nenhum turno lançado nesse período.
            </p>
          )}
          {motos.map((m) => (
            <article
              key={m.nome}
              className="flex items-center gap-3 rounded-card bg-white p-3 px-[15px] shadow-card"
            >
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-[15px] font-bold text-navy">{m.nome}</strong>
                <small className="text-xs text-muted">
                  {m.corridas} corridas · {m.dias} {m.dias === 1 ? "dia" : "dias"} ·{" "}
                  {(m.corridas / m.dias).toFixed(1)}/dia
                </small>
              </div>
              <div className="text-right">
                <span className="font-display text-[15px] font-bold tabular-nums">{brl(m.pago)}</span>
                {m.piso > 0 && (
                  <span className="block text-[10px] font-bold text-warn">piso {brl(m.piso)}</span>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* Tabela de bairros completa */}
        {bairros.length > 0 && (
          <>
            <h3 className="mb-2 mt-5 px-1 text-[11px] font-bold uppercase tracking-[0.5px] text-muted">
              Todos os bairros · {bairros.length}
            </h3>
            <div className="overflow-hidden rounded-card bg-white shadow-card reveal d5">
              {bairros.map((b, i) => (
                <div
                  key={b.nome}
                  className={`flex items-center gap-3 px-[15px] py-2.5 ${
                    i > 0 ? "border-t border-line" : ""
                  }`}
                >
                  <span className="w-6 shrink-0 text-[11px] font-bold text-muted tabular-nums">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-navy">
                    {b.nome}
                  </span>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-navy">
                    {b.corridas}
                  </span>
                  <span className="w-20 shrink-0 text-right text-[12px] tabular-nums text-muted">
                    {brl(b.valor)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

function SegBtn({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      className={`flex-1 rounded-xl border-[1.5px] py-2.5 text-center text-[13px] font-bold transition ${
        active ? "border-navy bg-navy text-white" : "border-line bg-white text-muted"
      }`}
    >
      {label}
    </a>
  );
}

function MiniCard({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
}) {
  return (
    <div className="flex-1 rounded-card bg-white p-3 shadow-card">
      <div className="text-[11px] font-semibold leading-tight text-muted">{label}</div>
      <div
        className={`mt-1.5 font-display text-[20px] font-bold leading-none tabular-nums ${
          warn ? "text-warn" : "text-navy"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] text-muted">{hint}</div>
    </div>
  );
}
