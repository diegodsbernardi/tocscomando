import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MIN_DAILY_PAYMENT } from "@/lib/motoboys";
import { startOfTuesdayWeek, endOfTuesdayWeek, todayISO, formatDateBR } from "@/lib/week";
import { CloseWeekButton, DeleteShiftButton } from "@/components/MotoboyShiftActions";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";

export const dynamic = "force-dynamic";

type Ride = { rides_count: number; fee_at_time: number };
type Shift = {
  id: string;
  motoboy_id: string;
  work_date: string;
  arrival_time: string | null;
  paid: boolean;
  notes: string | null;
  motoboys: { id: string; name: string } | null;
  motoboy_shift_rides: Ride[];
};

function brl(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function shiftTotal(shift: Shift) {
  return shift.motoboy_shift_rides.reduce(
    (acc, r) => acc + Number(r.rides_count) * Number(r.fee_at_time),
    0,
  );
}

function shiftRides(shift: Shift) {
  return shift.motoboy_shift_rides.reduce((acc, r) => acc + Number(r.rides_count), 0);
}

function effectiveAmount(total: number) {
  return Math.max(total, MIN_DAILY_PAYMENT);
}

export default async function MotoboysPage({
  searchParams,
}: {
  searchParams: { semana?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const refDate = searchParams.semana || todayISO();
  const weekStart = startOfTuesdayWeek(refDate);
  const weekEnd = endOfTuesdayWeek(refDate);
  const today = todayISO();

  const [{ data: shiftsData }, { data: motoboysData }] = await Promise.all([
    supabase
      .from("motoboy_shifts")
      .select("id, motoboy_id, work_date, arrival_time, paid, notes, motoboys(id, name), motoboy_shift_rides(rides_count, fee_at_time)")
      .gte("work_date", weekStart)
      .lte("work_date", weekEnd)
      .order("work_date", { ascending: false })
      .order("arrival_time", { ascending: true, nullsFirst: false }),
    supabase
      .from("motoboys")
      .select("id, name")
      .eq("active", true)
      .order("name"),
  ]);

  const shifts = (shiftsData || []) as unknown as Shift[];
  const motoboysCount = (motoboysData || []).length;

  const todayShifts = shifts.filter((s) => s.work_date === today);
  const todayTotal = todayShifts.reduce((acc, s) => acc + effectiveAmount(shiftTotal(s)), 0);
  const todayRides = todayShifts.reduce((acc, s) => acc + shiftRides(s), 0);

  // Agregação semanal por motoboy
  type WeekRow = {
    motoboy_id: string;
    name: string;
    rides: number;
    raw_total: number;
    paid_total: number;
    pending_total: number;
    pending_count: number;
  };
  const weekByMotoboy = new Map<string, WeekRow>();
  for (const s of shifts) {
    const m = s.motoboys;
    if (!m) continue;
    const total = shiftTotal(s);
    const effective = effectiveAmount(total);
    let row = weekByMotoboy.get(m.id);
    if (!row) {
      row = {
        motoboy_id: m.id,
        name: m.name,
        rides: 0,
        raw_total: 0,
        paid_total: 0,
        pending_total: 0,
        pending_count: 0,
      };
      weekByMotoboy.set(m.id, row);
    }
    row.rides += shiftRides(s);
    row.raw_total += total;
    if (s.paid) row.paid_total += effective;
    else {
      row.pending_total += effective;
      row.pending_count += 1;
    }
  }
  const weekRows = Array.from(weekByMotoboy.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );

  const weekTotalDue = weekRows.reduce((acc, r) => acc + r.pending_total, 0);
  const weekTotalPaid = weekRows.reduce((acc, r) => acc + r.paid_total, 0);
  const weekPendingCount = weekRows.reduce((acc, r) => acc + r.pending_count, 0);

  // Navegação entre semanas
  const prevWeekRef = (() => {
    const [y, m, d] = weekStart.split("-").map(Number);
    const dd = new Date(y, m - 1, d);
    dd.setDate(dd.getDate() - 1);
    return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`;
  })();
  const nextWeekRef = (() => {
    const [y, m, d] = weekEnd.split("-").map(Number);
    const dd = new Date(y, m - 1, d);
    dd.setDate(dd.getDate() + 1);
    return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`;
  })();

  return (
    <Shell>
      <TopBar
        title="Motoboys"
        subtitle="entregas dos terceiros"
        rightSlot={
          <Link
            href="/motoboys/historico"
            aria-label="Histórico"
            className="grid h-[38px] w-[38px] place-items-center rounded-xl bg-white text-navy shadow-card hover:bg-line"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </Link>
        }
      />
      <div className="px-4">

      {/* Hoje */}
      <section className="mb-4 rounded-hero bg-cyan-hero p-5 text-white shadow-glow reveal d2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Hoje</span>
          <span className="text-xs text-white/80">
            {todayShifts.length} {todayShifts.length === 1 ? "motoboy" : "motoboys"}
          </span>
        </div>
        <p className="mt-1 text-3xl font-bold tabular-nums">{brl(todayTotal)}</p>
        <p className="text-xs text-white/80">
          {todayRides} {todayRides === 1 ? "corrida" : "corridas"}
        </p>
      </section>

      <Link
        href="/motoboys/turno/novo"
        className="mb-4 flex items-center justify-center rounded-2xl bg-brand py-3 text-sm font-semibold text-white shadow hover:bg-brand-dark"
      >
        + Novo turno
      </Link>

      {/* Turnos da semana atual, agrupados por dia */}
      <h2 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>
          Semana {formatDateBR(weekStart, { day: "2-digit", month: "short" })} →{" "}
          {formatDateBR(weekEnd, { day: "2-digit", month: "short" })}
        </span>
        <span className="flex gap-1">
          <Link
            href={`/motoboys?semana=${prevWeekRef}`}
            className="rounded px-1.5 py-0.5 hover:bg-slate-100"
            aria-label="Semana anterior"
          >
            ←
          </Link>
          <Link
            href={`/motoboys?semana=${nextWeekRef}`}
            className="rounded px-1.5 py-0.5 hover:bg-slate-100"
            aria-label="Próxima semana"
          >
            →
          </Link>
        </span>
      </h2>

      <ShiftsList shifts={shifts} />

      {/* Resumo semanal por motoboy */}
      <section className="mt-5 rounded-2xl bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pagamento da semana
          </h2>
          <CloseWeekButton
            weekStart={weekStart}
            weekEnd={weekEnd}
            totalDue={weekTotalDue}
            pendingCount={weekPendingCount}
          />
        </div>

        {weekRows.length === 0 ? (
          <p className="py-3 text-center text-sm text-slate-500">Nenhum turno nesta semana.</p>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {weekRows.map((r) => {
                const total = r.paid_total + r.pending_total;
                return (
                  <div key={r.motoboy_id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{r.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {r.rides} corridas
                        {r.pending_count > 0 && (
                          <span className="ml-2 rounded bg-amber-100 px-1 py-0.5 text-amber-700">
                            {r.pending_count} pendente{r.pending_count > 1 ? "s" : ""}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-slate-800">
                        {brl(total)}
                      </p>
                      {r.pending_total > 0 && (
                        <p className="text-[11px] text-amber-700 tabular-nums">
                          {brl(r.pending_total)} a pagar
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="text-sm font-semibold text-slate-700">Total</span>
              <div className="text-right">
                <p className="text-base font-bold tabular-nums text-slate-900">
                  {brl(weekTotalPaid + weekTotalDue)}
                </p>
                <p className="text-[11px] text-slate-500">
                  Pago {brl(weekTotalPaid)} · A pagar {brl(weekTotalDue)}
                </p>
              </div>
            </div>
          </>
        )}
      </section>

      {motoboysCount === 0 && (
        <p className="mt-4 rounded-2xl bg-warn-bg p-4 text-sm text-warn">
          Nenhum motoboy cadastrado ainda.{" "}
          <Link href="/cadastros" className="font-bold underline">
            Cadastrar agora →
          </Link>
        </p>
      )}
      </div>
    </Shell>
  );
}

function ShiftsList({ shifts }: { shifts: Shift[] }) {
  if (shifts.length === 0) {
    return (
      <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow">
        Nenhum turno nesta semana.
      </p>
    );
  }

  // Agrupa por data
  const byDate = new Map<string, Shift[]>();
  for (const s of shifts) {
    if (!byDate.has(s.work_date)) byDate.set(s.work_date, []);
    byDate.get(s.work_date)!.push(s);
  }
  const dates = Array.from(byDate.keys());

  return (
    <div className="space-y-3">
      {dates.map((date) => {
        const list = byDate.get(date)!;
        const total = list.reduce((acc, s) => acc + effectiveAmount(shiftTotal(s)), 0);
        const rides = list.reduce((acc, s) => acc + shiftRides(s), 0);
        return (
          <section key={date}>
            <h3 className="mb-1 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>{formatDateBR(date, { weekday: "short", day: "2-digit", month: "short" })}</span>
              <span className="tabular-nums">
                {rides} corridas · {brl(total)}
              </span>
            </h3>
            <div className="space-y-2">
              {list.map((s) => {
                const total = shiftTotal(s);
                const effective = effectiveAmount(total);
                const belowMin = total < MIN_DAILY_PAYMENT;
                const rides = shiftRides(s);
                return (
                  <article
                    key={s.id}
                    className={`flex items-center justify-between gap-2 rounded-2xl p-3 shadow ${
                      s.paid ? "bg-emerald-50" : "bg-white"
                    }`}
                  >
                    <Link href={`/motoboys/turno/${s.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {s.motoboys?.name ?? "—"}
                        {s.arrival_time && (
                          <span className="ml-1 text-[11px] font-normal text-slate-500">
                            {s.arrival_time.slice(0, 5)}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {rides} corridas
                        {s.paid && <span className="ml-2 text-emerald-700">· pago</span>}
                      </p>
                    </Link>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-slate-800">
                        {brl(effective)}
                      </p>
                      {belowMin && (
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-red-600">
                          mín · era {brl(total)}
                        </p>
                      )}
                    </div>
                    <DeleteShiftButton id={s.id} />
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
