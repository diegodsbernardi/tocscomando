import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReopenButton, DeleteSessionButton } from "@/components/CashSessionActions";

export const dynamic = "force-dynamic";

type Drawer = { id: string; name: string };

type Session = {
  id: string;
  drawer_id: string;
  work_date: string;
  opened_at: string;
  opening_amount: number;
  closed_at: string | null;
  closing_amount: number | null;
  expected_amount: number | null;
  notes: string | null;
  status: "open" | "closed";
};

function brl(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function timeBR(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function dateBR(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export default async function CaixaPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: drawersData }, { data: sessionsData }] = await Promise.all([
    supabase.from("cash_drawers").select("id, name").eq("active", true).order("name"),
    supabase
      .from("cash_sessions")
      .select("id, drawer_id, work_date, opened_at, opening_amount, closed_at, closing_amount, expected_amount, notes, status")
      .order("work_date", { ascending: false })
      .order("opened_at", { ascending: false })
      .limit(60),
  ]);

  const drawers = (drawersData || []) as Drawer[];
  const sessions = (sessionsData || []) as Session[];
  const openByDrawer = new Map<string, Session>();
  for (const s of sessions) {
    if (s.status === "open" && !openByDrawer.has(s.drawer_id)) openByDrawer.set(s.drawer_id, s);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Caixa</h1>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Voltar
        </Link>
      </header>

      {/* Estado atual dos caixas */}
      <section className="mb-5 grid gap-3">
        {drawers.map((d) => {
          const open = openByDrawer.get(d.id);
          return (
            <article
              key={d.id}
              className={`rounded-2xl p-5 shadow ${
                open
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white"
                  : "bg-white text-slate-900"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className={`text-xs font-semibold uppercase tracking-wider ${open ? "text-white/80" : "text-slate-500"}`}>
                  {d.name}
                </span>
                <span className={`text-xs ${open ? "text-white/80" : "text-slate-500"}`}>
                  {open ? `Aberto desde ${timeBR(open.opened_at)}` : "Fechado"}
                </span>
              </div>
              {open ? (
                <>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{brl(Number(open.opening_amount))}</p>
                  <p className={`text-xs ${open ? "text-white/80" : "text-slate-500"}`}>abertura</p>
                  <Link
                    href={`/caixa/fechar/${open.id}`}
                    className="mt-3 block rounded-lg bg-white py-2 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    Fechar caixa
                  </Link>
                </>
              ) : (
                <Link
                  href={`/caixa/abrir?drawer=${d.id}`}
                  className="mt-3 block rounded-lg bg-brand py-2 text-center text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Abrir caixa
                </Link>
              )}
            </article>
          );
        })}
      </section>

      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Histórico ({sessions.length})
      </h2>
      {sessions.length === 0 && (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow">
          Nenhuma sessão ainda. Abra um caixa pra começar.
        </p>
      )}

      <div className="space-y-2">
        {sessions.map((s) => {
          const drawer = drawers.find((d) => d.id === s.drawer_id);
          const closed = s.status === "closed";
          const diff =
            closed && s.expected_amount != null && s.closing_amount != null
              ? Number(s.closing_amount) - Number(s.expected_amount)
              : null;
          return (
            <article key={s.id} className="rounded-2xl bg-white p-3 shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                      {drawer?.name ?? "—"}
                    </span>
                    <span className="text-xs text-slate-500">{dateBR(s.work_date)}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        closed ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {closed ? "Fechada" : "Aberta"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
                    <span>
                      Abertura{" "}
                      <span className="font-semibold tabular-nums text-slate-800">
                        {brl(Number(s.opening_amount))}
                      </span>
                    </span>
                    {closed && s.closing_amount != null && (
                      <span>
                        Fechamento{" "}
                        <span className="font-semibold tabular-nums text-slate-800">
                          {brl(Number(s.closing_amount))}
                        </span>
                      </span>
                    )}
                    {diff != null && (
                      <span
                        className={`font-semibold tabular-nums ${
                          diff === 0
                            ? "text-emerald-700"
                            : diff < 0
                              ? "text-red-700"
                              : "text-amber-700"
                        }`}
                      >
                        Dif {diff > 0 ? "+" : ""}
                        {brl(diff)}
                      </span>
                    )}
                  </div>
                  {s.notes && <p className="mt-1 text-[11px] text-slate-500">{s.notes}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {closed && <ReopenButton id={s.id} />}
                  <DeleteSessionButton id={s.id} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
