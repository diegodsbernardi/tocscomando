import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { brl } from "@/lib/format";
import {
  aggregate,
  chartByDayOfWeek,
  chartByMotoboy,
  chartByWeekOfMonth,
  monthRange,
  statsFromShift,
  todayISO,
  verdictFor,
  type Bucket,
  type RawShift,
  type ShiftStats,
} from "@/lib/motoboys-stats";
import {
  startOfTuesdayWeek,
  endOfTuesdayWeek,
  formatDateBR,
} from "@/lib/week";

export const dynamic = "force-dynamic";

type Period = "dia" | "semana" | "mes";

function periodRange(period: Period): { start: string; end: string; label: string } {
  const today = todayISO();
  if (period === "dia") {
    const label = `CORRIDAS HOJE · ${formatDateBR(today, { weekday: "short", day: "2-digit", month: "long" })}`;
    return { start: today, end: today, label };
  }
  if (period === "semana") {
    const start = startOfTuesdayWeek(today);
    const end = endOfTuesdayWeek(today);
    const startLabel = formatDateBR(start, { day: "2-digit", month: "short" });
    const endLabel = formatDateBR(end, { day: "2-digit", month: "short" });
    return { start, end, label: `CORRIDAS NA SEMANA · ${startLabel} → ${endLabel}` };
  }
  // mes
  const range = monthRange(today);
  // end aqui é exclusivo (dia 1 do próximo); convertemos pra "lt"
  const monthLbl = new Date(`${range.start}T00:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return {
    start: range.start,
    end: range.end,
    label: `CORRIDAS NO MÊS · ${monthLbl}`,
  };
}

export default async function HistoricoEntregasPage({
  searchParams,
}: {
  searchParams: { p?: Period };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const period: Period = searchParams.p === "semana" || searchParams.p === "mes" ? searchParams.p : "dia";
  const { start, end, label } = periodRange(period);

  // Query: semana e mês usam < end (exclusivo); dia usa = today
  let query = supabase
    .from("motoboy_shifts")
    .select("id, work_date, motoboy_id, motoboys(name), motoboy_shift_rides(rides_count, fee_at_time)");

  if (period === "dia") {
    query = query.eq("work_date", start);
  } else if (period === "mes") {
    query = query.gte("work_date", start).lt("work_date", end);
  } else {
    // semana
    query = query.gte("work_date", start).lte("work_date", end);
  }

  const { data } = await query;
  const rawShifts = ((data || []) as unknown as Array<{
    id: string;
    work_date: string;
    motoboy_id: string;
    motoboys: { name: string } | null;
    motoboy_shift_rides: { rides_count: number; fee_at_time: number }[];
  }>).map<RawShift>((s) => ({
    id: s.id,
    work_date: s.work_date,
    motoboy_id: s.motoboy_id,
    motoboys: s.motoboys,
    rides: s.motoboy_shift_rides || [],
  }));

  const shifts: ShiftStats[] = rawShifts.map(statsFromShift);
  const agg = aggregate(shifts);
  const verdict = verdictFor(agg, period);

  // Chart e título
  let chart: Bucket[];
  let chartTitle: string;
  if (period === "dia") {
    chart = chartByMotoboy(shifts);
    chartTitle = "Corridas por moto";
  } else if (period === "semana") {
    chart = chartByDayOfWeek(shifts);
    chartTitle = "Corridas por dia";
  } else {
    chart = chartByWeekOfMonth(shifts, start);
    chartTitle = "Corridas por semana";
  }

  // Top motoboys do período
  const byMoto = new Map<string, { name: string; rides: number; effective: number; floored: boolean }>();
  for (const s of shifts) {
    const cur = byMoto.get(s.motoboyId);
    if (cur) {
      cur.rides += s.rides;
      cur.effective += s.effective;
      cur.floored = cur.floored || s.floored;
    } else {
      byMoto.set(s.motoboyId, {
        name: s.motoboyName,
        rides: s.rides,
        effective: s.effective,
        floored: s.floored,
      });
    }
  }
  const topList = Array.from(byMoto.values())
    .sort((a, b) => b.effective - a.effective)
    .slice(0, 6);

  const listTitle =
    period === "dia"
      ? "Por motoboy hoje"
      : period === "semana"
        ? "Top motos da semana"
        : "Top motos do mês";

  return (
    <Shell>
      <TopBar
        title="Entregas · Histórico"
        subtitle="vale a pena chamar mais motos?"
        backHref="/motoboys"
      />

      <div className="px-4">
        {/* Segmented Dia/Semana/Mês */}
        <div className="flex gap-2 reveal d2">
          <SegBtn href="?p=dia" label="Dia" active={period === "dia"} />
          <SegBtn href="?p=semana" label="Semana" active={period === "semana"} />
          <SegBtn href="?p=mes" label="Mês" active={period === "mes"} />
        </div>

        {/* Hero */}
        <section className="relative mt-3 overflow-hidden rounded-hero p-5 px-5 text-white shadow-glow bg-cyan-hero reveal d2">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"
          />
          <div className="text-xs font-semibold tracking-[0.5px] opacity-85">{label}</div>
          <div className="mt-0.5 font-display text-[40px] font-extrabold leading-none tracking-[-1px]">
            {agg.totalRides} corridas
          </div>
          <div className="mt-1 text-[13px] opacity-90">
            {agg.totalMotos} {agg.totalMotos === 1 ? "moto" : "motos"} · {brl(agg.totalPago)} pago em entregas
          </div>
        </section>

        {/* 3 mini cards */}
        <div className="mt-3 flex gap-2.5 reveal d3">
          <MiniCard
            label="Corridas por moto"
            value={agg.totalMotos > 0 ? agg.ridesPerMoto.toFixed(1) : "—"}
            hint={`${agg.totalMotos} ${agg.totalMotos === 1 ? "moto" : "motos"}`}
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

        {/* Chart */}
        <section className="mt-3 rounded-card bg-white p-4 shadow-card reveal d3">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.5px] text-muted">
            {chartTitle}
          </div>
          <Chart buckets={chart} />
        </section>

        {/* Verdict */}
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

        {/* Lista top motoboys */}
        <h3 className="mb-2 mt-5 px-1 text-[11px] font-bold uppercase tracking-[0.5px] text-muted">
          {listTitle}
        </h3>
        <div className="space-y-2 reveal d5">
          {topList.length === 0 && (
            <p className="rounded-card bg-white p-6 text-center text-sm text-muted shadow-card">
              Nenhum turno lançado nesse período.
            </p>
          )}
          {topList.map((m) => (
            <article
              key={m.name}
              className="flex items-center gap-3 rounded-card bg-white p-3 px-[15px] shadow-card"
            >
              <div className="min-w-0 flex-1">
                <strong className="block text-[15px] font-bold text-navy">{m.name}</strong>
                <small className="text-xs text-muted">{m.rides} corridas</small>
              </div>
              <div className="text-right">
                <span className="font-display text-[15px] font-bold tabular-nums">
                  {brl(m.effective)}
                </span>
                {m.floored && (
                  <span className="ml-1 text-[10px] font-bold text-warn">↑ piso</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function SegBtn({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex-1 rounded-xl border-[1.5px] py-2.5 text-center text-[13px] font-bold transition ${
        active ? "border-navy bg-navy text-white" : "border-line bg-white text-muted"
      }`}
    >
      {label}
    </Link>
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

function Chart({ buckets }: { buckets: Bucket[] }) {
  const max = Math.max(...buckets.map((b) => b.value), 0);
  return (
    <div className="flex h-[120px] items-end gap-2">
      {buckets.map((b, i) => {
        const height = max > 0 ? (b.value / max) * 100 : 0;
        return (
          <div
            key={`${b.label}-${i}`}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
          >
            <span className="text-[10px] font-bold text-navy">{b.value}</span>
            <div
              className={`w-full min-h-[4px] rounded-t-[7px] rounded-b-[3px] transition-[height] duration-500 ease-out ${
                b.peak ? "bg-brandyellow" : "bg-cyan"
              }`}
              style={{ height: `${height}%` }}
            />
            <span className="text-[10px] font-semibold text-muted">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}
