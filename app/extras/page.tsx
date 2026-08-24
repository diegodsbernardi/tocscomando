import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { MarkPaidToggle, DeleteExtraButton } from "@/components/ExtraRowActions";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { brl } from "@/lib/format";
import { isoWeekRange, isoToday, VINCULO_LIMIT, levelForCount } from "@/lib/vinculo";
import { resolverPeriodo } from "@/lib/periodo";
import { toSPDate } from "@/lib/dates";
import { getCurrentProfile, roleLabel } from "@/lib/profile";
import { DataErrorCard } from "@/components/ui/DataErrorCard";

export const dynamic = "force-dynamic";

type Centro = "atendimento" | "cozinha";
type Visao = "dia" | "pessoa";

type Row = {
  id: string;
  work_date: string;
  amount: number;
  paid: boolean;
  paid_amount: number | null;
  paid_at: string | null;
  notes: string | null;
  employees: { id: string; name: string; centro_custo: Centro } | null;
};

function fmtDayBR(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export default async function ExtrasPage({
  searchParams,
}: {
  searchParams: { p?: string; de?: string; ate?: string; centro?: string; visao?: string; status?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const periodo = resolverPeriodo({ p: searchParams.p ?? "mes", de: searchParams.de, ate: searchParams.ate });
  const centro = (searchParams.centro || "todos") as "todos" | Centro;
  const visao: Visao = searchParams.visao === "pessoa" ? "pessoa" : "dia";
  const status = (searchParams.status === "pago" || searchParams.status === "pendente"
    ? searchParams.status
    : "todos") as "todos" | "pago" | "pendente";

  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  const week = isoWeekRange(isoToday());

  const [{ data: periodData, error: periodError }, { data: weekData }] = await Promise.all([
    supabase
      .from("extra_payments")
      .select(
        "id, work_date, amount, paid, paid_amount, paid_at, notes, employees(id, name, centro_custo)",
      )
      .gte("work_date", periodo.start)
      .lte("work_date", periodo.end)
      .order("work_date", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("extra_payments")
      .select("employee_id")
      .gte("work_date", week.start)
      .lte("work_date", week.end),
  ]);

  let rows = ((periodData || []) as unknown as Row[]).filter((r) => r.employees);
  if (centro !== "todos") rows = rows.filter((r) => r.employees?.centro_custo === centro);
  if (status !== "todos") rows = rows.filter((r) => (status === "pago" ? r.paid : !r.paid));

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

  const dangerCount = Array.from(weekCount.values()).filter((c) => c >= VINCULO_LIMIT).length;

  // Agrupamentos das duas visões
  const porDia = rows.reduce((acc, r) => {
    (acc[r.work_date] ||= []).push(r);
    return acc;
  }, {} as Record<string, Row[]>);
  const dias = Object.keys(porDia);

  const porPessoaMap = new Map<
    string,
    { id: string; nome: string; centro: Centro; total: number; pago: number; pendente: number; vezes: number; datas: string[] }
  >();
  for (const r of rows) {
    const f = r.employees!;
    const cur = porPessoaMap.get(f.id) ?? {
      id: f.id,
      nome: f.name,
      centro: f.centro_custo,
      total: 0,
      pago: 0,
      pendente: 0,
      vezes: 0,
      datas: [],
    };
    const v = Number(r.amount);
    cur.total += v;
    if (r.paid) cur.pago += v;
    else cur.pendente += v;
    cur.vezes += 1;
    cur.datas.push(r.work_date);
    porPessoaMap.set(f.id, cur);
  }
  const pessoas = Array.from(porPessoaMap.values()).sort((a, b) => b.total - a.total);

  // Links preservando filtros
  const qs = (over: Partial<Record<string, string>>) => {
    const sp = new URLSearchParams();
    sp.set("p", periodo.key);
    if (periodo.key === "custom") {
      sp.set("de", periodo.start);
      sp.set("ate", periodo.end);
    }
    sp.set("centro", centro);
    sp.set("visao", visao);
    sp.set("status", status);
    for (const [k, v] of Object.entries(over)) if (v) sp.set(k, v);
    return `?${sp.toString()}`;
  };

  const extrasFiltro = { centro, visao, status };

  return (
    <Shell>
      <TopBar title="Extras" subtitle="freelancers por período" role={roleLabel(profile)} />

      <div className="px-4">
        <PeriodoFilter periodo={periodo} extras={extrasFiltro} />

        {isAdmin && (
          <section className="relative mt-3 overflow-hidden rounded-hero p-5 px-5 text-white shadow-glow bg-cyan-hero reveal d2">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"
            />
            <div className="text-xs font-semibold tracking-[0.5px] opacity-85">
              {periodo.titulo} · {periodo.label}
            </div>
            <div className="mt-0.5 font-display text-3xl font-extrabold tracking-[-1px]">
              {brl(totals.total)}
            </div>
            <div className="mt-1 text-[13px] opacity-90">
              {rows.length} diária{rows.length === 1 ? "" : "s"} · {pessoas.length} pessoa
              {pessoas.length === 1 ? "" : "s"} ·{" "}
              {periodo.dias > 0 ? brl(totals.total / periodo.dias) : brl(0)}/dia
            </div>
            <div className="mt-3 flex border-t border-white/20 pt-3">
              <SplitCol label="PAGO" value={brl(totals.pago)} />
              <SplitCol label="PENDENTE" value={brl(totals.pendente)} highlight />
              <SplitCol label="EM PERIGO" value={String(dangerCount)} />
            </div>
          </section>
        )}

        {/* Filtros */}
        <div className="mt-3 flex gap-2 reveal d3">
          <Chip href={qs({ centro: "todos" })} label="Todos" active={centro === "todos"} />
          <Chip href={qs({ centro: "cozinha" })} label="Cozinha" active={centro === "cozinha"} />
          <Chip href={qs({ centro: "atendimento" })} label="Atendimento" active={centro === "atendimento"} />
        </div>
        <div className="mt-2 flex gap-2 reveal d3">
          <Chip href={qs({ status: "todos" })} label="Todos" active={status === "todos"} />
          <Chip href={qs({ status: "pago" })} label="✓ Pagos" active={status === "pago"} />
          <Chip href={qs({ status: "pendente" })} label="⏳ Pendentes" active={status === "pendente"} />
        </div>
        <div className="mt-2 flex gap-2 reveal d3">
          <Chip href={qs({ visao: "dia" })} label="Por dia" active={visao === "dia"} big />
          <Chip href={qs({ visao: "pessoa" })} label="Por pessoa" active={visao === "pessoa"} big />
        </div>

        <div className="mt-3 flex gap-2">
          <Link
            href="/extras/novo"
            className="flex-1 rounded-2xl bg-brandyellow py-3.5 text-center text-[15px] font-bold text-navy shadow-card"
          >
            + Novo extra
          </Link>
          {isAdmin && (
            <Link
              href="/extras/faturamento"
              className="grid place-items-center rounded-2xl border-[1.5px] border-navy bg-white px-4 text-[13px] font-bold text-navy"
            >
              📊 x Faturamento
            </Link>
          )}
        </div>

        {periodError && <div className="mt-4"><DataErrorCard /></div>}

        {/* VISÃO POR PESSOA */}
        {!periodError && visao === "pessoa" && (
          <div className="mt-4 space-y-2 reveal d4">
            {pessoas.length === 0 && <Vazio />}
            {pessoas.map((p) => (
              <article key={p.id} className="rounded-card bg-white p-3 px-[15px] shadow-card">
                <div className="flex items-center gap-3">
                  <Link href={`/extras/perfil/${p.id}`} className="min-w-0 flex-1">
                    <strong className="block truncate text-[15px] font-bold text-navy">{p.nome}</strong>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <SectorTag centro={p.centro} />
                      <span className="text-[11px] text-muted">
                        {p.vezes}x no período · {brl(p.total / p.vezes)} média
                      </span>
                    </div>
                  </Link>
                  <div className="text-right">
                    <span className="font-display text-[17px] font-bold tabular-nums">
                      {brl(p.total)}
                    </span>
                    {p.pendente > 0 && (
                      <span className="block text-[10px] font-bold text-warn">
                        {brl(p.pendente)} pendente
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1 border-t border-line pt-2">
                  {p.datas
                    .slice()
                    .sort()
                    .map((d, i) => (
                      <span
                        key={`${d}-${i}`}
                        className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted"
                      >
                        {d.slice(8, 10)}/{d.slice(5, 7)}
                      </span>
                    ))}
                </div>
              </article>
            ))}
          </div>
        )}

        {/* VISÃO POR DIA */}
        {!periodError && visao === "dia" && (
          <div className="mt-4 space-y-3 reveal d4">
            {dias.length === 0 && <Vazio />}
            {dias.map((day) => {
              const doDia = porDia[day];
              const totalDia = doDia.reduce((a, r) => a + Number(r.amount), 0);
              return (
                <section key={day}>
                  <h3 className="mb-1 flex items-baseline justify-between px-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                      {fmtDayBR(day)}
                    </span>
                    <span className="text-[11px] font-bold tabular-nums text-muted">
                      {doDia.length}x · {brl(totalDia)}
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {doDia.map((r) => {
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
                              {r.paid ? (
                                <span className="rounded bg-ok-bg px-2 py-0.5 text-[10px] font-extrabold text-ok">
                                  ✓ pago{r.paid_at ? ` ${toSPDate(r.paid_at).slice(8, 10)}/${toSPDate(r.paid_at).slice(5, 7)}` : ""}
                                </span>
                              ) : (
                                <span className="rounded bg-warn-bg px-2 py-0.5 text-[10px] font-extrabold text-warn">
                                  ⏳ pendente
                                </span>
                              )}
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
                              {r.notes && <span className="text-[11px] text-muted">· {r.notes}</span>}
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
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}

function Vazio() {
  return (
    <p className="rounded-card bg-white p-6 text-center text-sm text-muted shadow-card">
      Nenhum extra neste filtro.
    </p>
  );
}

function SplitCol({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex-1">
      <div className="text-[11px] font-semibold opacity-80">{label}</div>
      <div className={`mt-0.5 text-[17px] font-bold tabular-nums ${highlight ? "text-brandyellow" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Chip({
  href,
  label,
  active,
  big,
}: {
  href: string;
  label: string;
  active: boolean;
  big?: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex-1 rounded-xl border-[1.5px] text-center font-semibold transition ${
        big ? "py-2.5 text-[13px] font-bold" : "py-2 text-xs"
      } ${active ? "border-navy bg-navy text-white" : "border-line bg-white text-muted"}`}
    >
      {label}
    </a>
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
