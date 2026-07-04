import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { MarkPaidToggle, DeleteExtraButton } from "@/components/ExtraRowActions";
import { brl } from "@/lib/format";
import { isoWeekRange, isoToday, VINCULO_LIMIT, levelForCount } from "@/lib/vinculo";
import { getCurrentProfile, roleLabel } from "@/lib/profile";

export const dynamic = "force-dynamic";

type Centro = "atendimento" | "cozinha";

type Row = {
  id: string;
  work_date: string;
  amount: number;
  paid: boolean;
  paid_amount: number | null;
  notes: string | null;
  employees: { id: string; name: string; centro_custo: Centro } | null;
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = new Date(y, m, 1);
  const end = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

function fmtDayBR(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
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

export default async function ExtrasPage({
  searchParams,
}: {
  searchParams: { mes?: string; centro?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const mes = searchParams.mes || currentMonth();
  const centro = (searchParams.centro || "todos") as
    | "todos"
    | "atendimento"
    | "cozinha";
  const profile = await getCurrentProfile();
  const { start, end } = monthRange(mes);
  const week = isoWeekRange(isoToday());

  // Buscar registros do mês
  const monthQuery = supabase
    .from("extra_payments")
    .select("id, work_date, amount, paid, paid_amount, notes, employees(id, name, centro_custo)")
    .gte("work_date", start)
    .lt("work_date", end)
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: true });

  // Buscar todos da semana corrente (para contagem de vínculo)
  const weekQuery = supabase
    .from("extra_payments")
    .select("employee_id")
    .gte("work_date", week.start)
    .lte("work_date", week.end);

  const [{ data: monthData }, { data: weekData }] = await Promise.all([
    monthQuery,
    weekQuery,
  ]);

  let rows = ((monthData || []) as unknown as Row[]).filter((r) => r.employees);
  if (centro !== "todos") {
    rows = rows.filter((r) => r.employees?.centro_custo === centro);
  }

  // Contagem de vindas na semana por employee
  const weekCount = new Map<string, number>();
  for (const r of weekData || []) {
    const id = (r as { employee_id: string }).employee_id;
    weekCount.set(id, (weekCount.get(id) ?? 0) + 1);
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.total += Number(r.amount);
      if (r.paid) acc.pago += Number(r.amount);
      else acc.pendente += Number(r.amount);
      return acc;
    },
    { total: 0, pago: 0, pendente: 0 },
  );

  // Pessoas em perigo (semana atual): conta funcionários distintos com count >= LIMITE
  const dangerCount = Array.from(weekCount.values()).filter((c) => c >= VINCULO_LIMIT).length;

  // Agrupa por dia
  const grouped = rows.reduce((acc, r) => {
    (acc[r.work_date] ||= []).push(r);
    return acc;
  }, {} as Record<string, Row[]>);
  const days = Object.keys(grouped);

  return (
    <Shell>
      <TopBar title="Extras" subtitle="freelancers do mês" role={roleLabel(profile)} />

      <div className="px-4">
        {/* HERO */}
        <section className="relative mt-1 overflow-hidden rounded-hero p-5 px-5 text-white shadow-glow bg-cyan-hero reveal d2">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"
          />
          <div className="flex items-center justify-between">
            <Link
              href={`?mes=${shiftMonth(mes, -1)}&centro=${centro}`}
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
                href={`?mes=${shiftMonth(mes, 1)}&centro=${centro}`}
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
          <div className="mt-0.5 font-display text-3xl font-extrabold tracking-[-1px]">
            {brl(totals.total)}
          </div>
          <div className="mt-3 flex border-t border-white/20 pt-3">
            <SplitCol label="PAGO" value={brl(totals.pago)} />
            <SplitCol label="PENDENTE" value={brl(totals.pendente)} highlight />
            <SplitCol label="EM PERIGO" value={String(dangerCount)} />
          </div>
        </section>

        {/* Filtros centro de custo */}
        <div className="mt-4 flex gap-2 reveal d3">
          <FilterChip href={`?mes=${mes}&centro=todos`} label="Todos" active={centro === "todos"} />
          <FilterChip href={`?mes=${mes}&centro=cozinha`} label="Cozinha" active={centro === "cozinha"} />
          <FilterChip href={`?mes=${mes}&centro=atendimento`} label="Atendimento" active={centro === "atendimento"} />
        </div>

        {/* CTA novo */}
        <Link
          href="/extras/novo"
          className="mt-3 block w-full rounded-2xl bg-brandyellow py-3.5 text-center text-[15px] font-bold text-navy shadow-card"
        >
          + Novo extra
        </Link>

        {/* Lista */}
        <div className="mt-4 space-y-3 reveal d4">
          {days.length === 0 && (
            <p className="rounded-card bg-white p-6 text-center text-sm text-muted shadow-card">
              Nenhum extra neste filtro.
            </p>
          )}

          {days.map((day) => (
            <section key={day}>
              <h3 className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                {fmtDayBR(day)}
              </h3>
              <div className="space-y-2">
                {grouped[day].map((r) => {
                  const f = r.employees!;
                  const c = weekCount.get(f.id) || 0;
                  const lvl = levelForCount(c);
                  return (
                    <article
                      key={r.id}
                      className="flex items-center gap-3 rounded-card bg-white p-3 px-[15px] shadow-card"
                    >
                      <Link href={`/extras/perfil/${f.id}`} className="min-w-0 flex-1">
                        <strong className="block truncate text-[15px] font-bold text-navy">
                          {f.name}
                        </strong>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <SectorTag centro={f.centro_custo} />
                          {lvl === "danger" && (
                            <span className="rounded bg-danger-bg px-2 py-0.5 text-[10px] font-extrabold text-danger">
                              ⚠ {c}x/sem
                            </span>
                          )}
                          {lvl === "warn" && (
                            <span className="rounded bg-warn-bg px-2 py-0.5 text-[10px] font-extrabold text-warn">
                              {c}x/sem
                            </span>
                          )}
                          {r.notes && (
                            <span className="text-[11px] text-muted">· {r.notes}</span>
                          )}
                        </div>
                      </Link>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="font-display text-[17px] font-bold tabular-nums">
                          {brl(Number(r.amount))}
                        </span>
                        <MarkPaidToggle id={r.id} paid={r.paid} />
                      </div>
                      <DeleteExtraButton id={r.id} />
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function SplitCol({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex-1">
      <div className="text-[11px] font-semibold opacity-80">{label}</div>
      <div
        className={`mt-0.5 text-[17px] font-bold tabular-nums ${
          highlight ? "text-brandyellow" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex-1 rounded-xl border-[1.5px] py-2 text-center text-xs font-semibold transition ${
        active
          ? "border-navy bg-navy text-white"
          : "border-line bg-white text-muted"
      }`}
    >
      {label}
    </Link>
  );
}

function SectorTag({ centro }: { centro: Centro }) {
  if (centro === "cozinha") {
    return (
      <span className="rounded bg-cozinha-bg px-2 py-0.5 text-[10px] font-bold text-cozinha">
        Cozinha
      </span>
    );
  }
  return (
    <span className="rounded bg-atend-bg px-2 py-0.5 text-[10px] font-bold text-atend">
      Atendimento
    </span>
  );
}
