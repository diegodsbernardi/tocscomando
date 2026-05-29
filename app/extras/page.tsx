import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarkPaidToggle, DeleteExtraButton } from "@/components/ExtraRowActions";

export const dynamic = "force-dynamic";

type Centro = "atendimento" | "cozinha";

type Row = {
  id: string;
  work_date: string;
  amount: number;
  paid: boolean;
  paid_amount: number | null;
  notes: string | null;
  employees: { name: string; centro_custo: Centro } | null;
};

function brl(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export default async function ExtrasPage({
  searchParams,
}: {
  searchParams: { mes?: string; status?: string; centro?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const mes = searchParams.mes || currentMonth();
  const status = searchParams.status || "todos"; // todos | pendente | pago
  const centro = searchParams.centro || "todos"; // todos | atendimento | cozinha
  const { start, end } = monthRange(mes);

  let q = supabase
    .from("extra_payments")
    .select("id, work_date, amount, paid, paid_amount, notes, employees(name, centro_custo)")
    .gte("work_date", start)
    .lt("work_date", end)
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: true });

  if (status === "pendente") q = q.eq("paid", false);
  if (status === "pago") q = q.eq("paid", true);

  const { data } = await q;
  let rows = ((data || []) as unknown as Row[]).filter((r) => r.employees);
  if (centro !== "todos") {
    rows = rows.filter((r) => r.employees?.centro_custo === centro);
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

  // Agrupa por dia
  const grouped = rows.reduce((acc, r) => {
    (acc[r.work_date] ||= []).push(r);
    return acc;
  }, {} as Record<string, Row[]>);
  const days = Object.keys(grouped);

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Extras</h1>
        <div className="flex gap-2">
          <Link
            href="/extras/funcionarios"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Funcionários
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Voltar
          </Link>
        </div>
      </header>

      {/* Filtros */}
      <form method="GET" className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-white p-3 shadow">
        <label className="col-span-3 flex flex-col text-xs font-medium text-slate-600">
          Mês
          <input
            type="month"
            name="mes"
            defaultValue={mes}
            className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs font-medium text-slate-600">
          Status
          <select
            name="status"
            defaultValue={status}
            className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="todos">Todos</option>
            <option value="pendente">Pendentes</option>
            <option value="pago">Pagos</option>
          </select>
        </label>
        <label className="flex flex-col text-xs font-medium text-slate-600">
          Centro
          <select
            name="centro"
            defaultValue={centro}
            className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="todos">Todos</option>
            <option value="atendimento">Atendimento</option>
            <option value="cozinha">Cozinha</option>
          </select>
        </label>
        <button
          type="submit"
          className="col-span-1 self-end rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Filtrar
        </button>
      </form>

      {/* Resumo */}
      <section className="mb-4 rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-5 text-white shadow-lg">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
            {new Date(`${mes}-02`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </span>
          <span className="text-xs tabular-nums text-white/80">
            {rows.length} {rows.length === 1 ? "registro" : "registros"}
          </span>
        </div>
        <p className="mt-1 text-3xl font-bold tabular-nums">{brl(totals.total)}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/20 pt-3">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Pago</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{brl(totals.pago)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Pendente</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{brl(totals.pendente)}</p>
          </div>
        </div>
      </section>

      <Link
        href="/extras/novo"
        className="mb-4 flex items-center justify-center rounded-2xl bg-brand py-3 text-sm font-semibold text-white shadow hover:bg-brand-dark"
      >
        + Novo extra
      </Link>

      {days.length === 0 && (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow">
          Nenhum extra neste filtro.
        </p>
      )}

      {days.map((day) => {
        const list = grouped[day];
        const sum = list.reduce((a, r) => a + Number(r.amount), 0);
        return (
          <section key={day} className="mb-4">
            <h2 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>{fmtDayBR(day)}</span>
              <span className="tabular-nums">{brl(sum)}</span>
            </h2>
            <div className="space-y-2">
              {list.map((r) => (
                <article
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {r.employees?.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {r.employees?.centro_custo === "atendimento" ? "Atendimento" : "Cozinha"}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-slate-700">
                    {brl(Number(r.amount))}
                  </span>
                  <MarkPaidToggle id={r.id} paid={r.paid} />
                  <DeleteExtraButton id={r.id} />
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
