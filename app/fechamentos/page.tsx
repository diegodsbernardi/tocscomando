import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { brl } from "@/lib/format";
import { getCurrentProfile, roleLabel } from "@/lib/profile";
import { DataErrorCard } from "@/components/ui/DataErrorCard";
import { currentMonth as spCurrentMonth } from "@/lib/dates";
import { formatDateBR } from "@/lib/week";

export const dynamic = "force-dynamic";

type Closure = {
  id: string;
  work_date: string;
  closed_by_name: string | null;
  moto_total: number | null;
  extras_pagos: number | null;
  extras_pendentes: number | null;
  cash_total: number | null;
  cash_diff: number | null;
  card_total: number | null;
};

function currentMonth() {
  return spCurrentMonth();
}

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = new Date(y, m, 1);
  const end = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .toUpperCase();
}

// Semáforo da quebra de caixa
function diffLevel(diff: number): "ok" | "warn" | "danger" {
  const abs = Math.abs(diff);
  if (abs <= 5) return "ok";
  if (abs <= 30) return "warn";
  return "danger";
}

const LEVEL_CLASSES: Record<string, string> = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
};

export default async function FechamentosPage({
  searchParams,
}: {
  searchParams: { mes?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/");

  const mes = searchParams.mes || currentMonth();
  const { start, end } = monthRange(mes);

  const { data, error } = await supabase
    .from("day_closures")
    .select(
      "id, work_date, closed_by_name, moto_total, extras_pagos, extras_pendentes, cash_total, cash_diff, card_total",
    )
    .gte("work_date", start)
    .lt("work_date", end)
    .order("work_date", { ascending: false });

  const rows = (data || []) as Closure[];

  const totals = rows.reduce(
    (acc, r) => {
      acc.cartoes += Number(r.card_total) || 0;
      acc.quebra += Number(r.cash_diff) || 0;
      return acc;
    },
    { cartoes: 0, quebra: 0 },
  );

  return (
    <Shell>
      <TopBar
        title="Fechamentos"
        subtitle="histórico dos dias"
        backHref="/painel"
        role={roleLabel(profile)}
      />

      <div className="px-4">
        {/* HERO do mês */}
        <section className="relative mt-1 overflow-hidden rounded-hero p-5 text-white shadow-glow bg-cyan-hero reveal d2">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"
          />
          <div className="flex items-center justify-between">
            <Link
              href={`?mes=${shiftMonth(mes, -1)}`}
              aria-label="Mês anterior"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-base font-bold"
            >
              ‹
            </Link>
            <div className="text-xs font-semibold tracking-[0.5px] opacity-85">
              {monthLabel(mes)}
            </div>
            {mes < currentMonth() ? (
              <Link
                href={`?mes=${shiftMonth(mes, 1)}`}
                aria-label="Próximo mês"
                className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-base font-bold"
              >
                ›
              </Link>
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-base font-bold opacity-30">
                ›
              </span>
            )}
          </div>
          <div className="mt-0.5 font-display text-3xl font-extrabold tracking-[-1px] tabular-nums">
            {brl(totals.cartoes)}
          </div>
          <div className="text-[11px] font-semibold opacity-85">cartões no mês</div>
          <div className="mt-3 flex border-t border-white/20 pt-3">
            <div className="flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.5px] opacity-75">
                Quebra acumulada
              </div>
              <div
                className={`text-[15px] font-bold tabular-nums ${
                  totals.quebra < 0 ? "text-danger" : ""
                }`}
              >
                {brl(totals.quebra)}
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.5px] opacity-75">
                Dias fechados
              </div>
              <div className="text-[15px] font-bold tabular-nums">{rows.length}</div>
            </div>
          </div>
        </section>

        {/* Lista */}
        <div className="mt-4 space-y-3 pb-8 reveal d3">
          {error && <DataErrorCard />}
          {!error && rows.length === 0 && (
            <p className="rounded-card bg-white p-6 text-center text-sm text-muted shadow-card">
              Nenhum dia fechado neste mês ainda.
            </p>
          )}
          {!error &&
            rows.map((r) => {
              const diff = Number(r.cash_diff) || 0;
              const level = diffLevel(diff);
              return (
                <article key={r.id} className="rounded-card bg-white p-4 shadow-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="block text-sm font-bold capitalize text-navy">
                        {formatDateBR(r.work_date, {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })}
                      </strong>
                      <span className="text-[11px] text-muted">
                        fechado por {r.closed_by_name || "—"}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ${LEVEL_CLASSES[level]}`}
                    >
                      {diff > 0 ? "+" : ""}
                      {brl(diff)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                    <MiniStat label="Cartões" value={brl(Number(r.card_total) || 0)} />
                    <MiniStat label="Motoboys" value={brl(Number(r.moto_total) || 0)} />
                    <MiniStat
                      label="Extras"
                      value={brl(
                        (Number(r.extras_pagos) || 0) + (Number(r.extras_pendentes) || 0),
                      )}
                    />
                  </div>
                </article>
              );
            })}
        </div>
      </div>
    </Shell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.5px] text-muted">
        {label}
      </div>
      <div className="text-[13px] font-bold tabular-nums text-navy">{value}</div>
    </div>
  );
}
