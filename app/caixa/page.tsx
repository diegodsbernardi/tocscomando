import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { DataErrorCard } from "@/components/ui/DataErrorCard";
import { TopBar } from "@/components/ui/TopBar";
import { CashMovementForm } from "@/components/CashMovementForm";
import { CashMovementList, type Movement } from "@/components/CashMovementList";
import { ReopenButton, DeleteSessionButton } from "@/components/CashSessionActions";
import { CashBreakdownDetails, type Breakdown } from "@/components/CashBreakdown";
import { brl } from "@/lib/format";
import { getCurrentProfile, visibleDrawerFilter, roleLabel } from "@/lib/profile";

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
  opening_breakdown: Breakdown;
  closing_breakdown: Breakdown;
};

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

const DRAWER_LABEL: Record<string, string> = {
  DLV: "Delivery",
  LTDA: "Salão",
};

export default async function CaixaPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  const scopedDrawerId = visibleDrawerFilter(profile);

  let drawersQuery = supabase.from("cash_drawers").select("id, name").eq("active", true).order("name");
  let sessionsQuery = supabase
    .from("cash_sessions")
    .select("id, drawer_id, work_date, opened_at, opening_amount, closed_at, closing_amount, expected_amount, notes, status, opening_breakdown, closing_breakdown")
    .order("work_date", { ascending: false })
    .order("opened_at", { ascending: false })
    .limit(40);

  if (scopedDrawerId) {
    drawersQuery = drawersQuery.eq("id", scopedDrawerId);
    sessionsQuery = sessionsQuery.eq("drawer_id", scopedDrawerId);
  }

  const [
    { data: drawersData, error: drawersError },
    { data: sessionsData, error: sessionsError },
  ] = await Promise.all([drawersQuery, sessionsQuery]);
  const loadError = drawersError || sessionsError;

  const drawers = (drawersData || []) as Drawer[];
  const sessions = (sessionsData || []) as Session[];
  const openByDrawer = new Map<string, Session>();
  for (const s of sessions) {
    if (s.status === "open" && !openByDrawer.has(s.drawer_id)) openByDrawer.set(s.drawer_id, s);
  }

  // Movimentações das sessões abertas
  const openIds = Array.from(openByDrawer.values()).map((s) => s.id);
  const movsBySession: Record<string, Movement[]> = {};
  if (openIds.length > 0) {
    const { data: movs } = await supabase
      .from("cash_movements")
      .select("id, session_id, direction, category, amount, note, created_at")
      .in("session_id", openIds)
      .order("created_at", { ascending: false });
    for (const m of movs || []) {
      const sid = (m as { session_id: string }).session_id;
      (movsBySession[sid] ||= []).push({
        id: m.id,
        direction: m.direction as "in" | "out",
        category: m.category,
        amount: Number(m.amount),
        note: m.note,
        created_at: m.created_at,
      });
    }
  }

  return (
    <Shell>
      <TopBar
        title="Caixa"
        subtitle={new Date().toLocaleDateString("pt-BR", {
          weekday: "short",
          day: "2-digit",
          month: "long",
          timeZone: "America/Sao_Paulo",
        })}
        role={roleLabel(profile)}
      />

      <div className="px-4">
        {loadError && <div className="mb-3"><DataErrorCard /></div>}
        {/* Heros por caixa */}
        <section className="grid gap-3 reveal d2">
          {drawers.map((d) => {
            const open = openByDrawer.get(d.id);
            const label = DRAWER_LABEL[d.name] || d.name;
            const movs = open ? movsBySession[open.id] || [] : [];
            const ins = movs.filter((m) => m.direction === "in").reduce((s, m) => s + m.amount, 0);
            const outs = movs.filter((m) => m.direction === "out").reduce((s, m) => s + m.amount, 0);
            return (
              <article
                key={d.id}
                className="rounded-hero bg-white p-5 text-center shadow-card"
              >
                <div className="text-2xl">{d.name === "DLV" ? "🛵" : "🍔"}</div>
                <div
                  className={`mt-1.5 inline-block rounded-full px-3 py-1 text-[11px] font-bold ${
                    open ? "bg-ok-bg text-ok" : "bg-line text-muted"
                  }`}
                >
                  {label} · {open ? "aberto" : "fechado"}
                </div>
                {open ? (
                  <>
                    <p className="mt-2 font-display text-3xl font-extrabold tracking-[-1px]">
                      {brl(Number(open.opening_amount))}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      aberto às {timeBR(open.opened_at)}
                    </p>
                    {(ins > 0 || outs > 0) && (
                      <p className="mt-1 text-[11px] text-muted">
                        saídas <span className="font-bold text-danger">−{brl(outs)}</span>{" "}
                        · entradas <span className="font-bold text-ok">+{brl(ins)}</span>
                      </p>
                    )}
                    <div className="mx-auto max-w-xs text-left">
                      <CashBreakdownDetails
                        breakdown={open.opening_breakdown}
                        label="Ver contagem da abertura"
                      />
                    </div>
                    <Link
                      href={`/caixa/fechar/${open.id}`}
                      className="mt-3 block rounded-2xl bg-navy py-3 text-sm font-bold text-white"
                    >
                      Fechar caixa
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-muted">
                      Sem sessão aberta hoje
                    </p>
                    <Link
                      href={`/caixa/abrir?drawer=${d.id}`}
                      className="mt-3 block rounded-2xl bg-cyan py-3 text-sm font-bold text-white"
                    >
                      Abrir caixa
                    </Link>
                  </>
                )}
              </article>
            );
          })}
        </section>

        {/* Movimentações das sessões abertas */}
        {openIds.length > 0 && (
          <section className="mt-4 space-y-3 reveal d3">
            {Array.from(openByDrawer.values()).map((s) => {
              const drawer = drawers.find((d) => d.id === s.drawer_id);
              const label = drawer ? DRAWER_LABEL[drawer.name] || drawer.name : "";
              const movs = movsBySession[s.id] || [];
              return (
                <div key={s.id} className="rounded-card bg-white p-4 shadow-card">
                  <div className="mb-2 flex items-center justify-between">
                    <strong className="text-sm font-bold">
                      Movimentações · {label}
                    </strong>
                    <span className="text-[11px] font-semibold text-muted">
                      {movs.length} {movs.length === 1 ? "lançamento" : "lançamentos"}
                    </span>
                  </div>
                  <CashMovementList items={movs} />
                  <div className="mt-3">
                    <CashMovementForm sessionId={s.id} />
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Histórico */}
        <h2 className="mb-2 mt-5 px-1 text-xs font-bold uppercase tracking-wider text-muted">
          Histórico ({sessions.filter((s) => s.status === "closed").length})
        </h2>

        <div className="space-y-2">
          {sessions
            .filter((s) => s.status === "closed")
            .map((s) => {
              const drawer = drawers.find((d) => d.id === s.drawer_id);
              const label = drawer ? DRAWER_LABEL[drawer.name] || drawer.name : "—";
              const diff =
                s.expected_amount != null && s.closing_amount != null
                  ? Number(s.closing_amount) - Number(s.expected_amount)
                  : null;
              return (
                <article key={s.id} className="rounded-card bg-white p-3 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-line px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                          {label}
                        </span>
                        <span className="text-xs text-muted">{dateBR(s.work_date)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                        <span>
                          Abertura{" "}
                          <span className="font-bold text-navy">
                            {brl(Number(s.opening_amount))}
                          </span>
                        </span>
                        {s.closing_amount != null && (
                          <span>
                            Fechamento{" "}
                            <span className="font-bold text-navy">
                              {brl(Number(s.closing_amount))}
                            </span>
                          </span>
                        )}
                        {diff != null && (
                          <span
                            className={`font-bold tabular-nums ${
                              diff === 0
                                ? "text-ok"
                                : diff < 0
                                  ? "text-danger"
                                  : "text-warn"
                            }`}
                          >
                            Dif {diff > 0 ? "+" : ""}
                            {brl(diff)}
                          </span>
                        )}
                      </div>
                      {s.notes && (
                        <p className="mt-1 text-[11px] text-muted">{s.notes}</p>
                      )}
                      <CashBreakdownDetails
                        breakdown={s.opening_breakdown}
                        label="Contagem da abertura"
                      />
                      <CashBreakdownDetails
                        breakdown={s.closing_breakdown}
                        label="Contagem do fechamento"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <ReopenButton id={s.id} />
                      {profile?.role === "admin" && <DeleteSessionButton id={s.id} />}
                    </div>
                  </div>
                </article>
              );
            })}
          {sessions.filter((s) => s.status === "closed").length === 0 && (
            <p className="rounded-card bg-white p-6 text-center text-sm text-muted shadow-card">
              Nenhuma sessão fechada ainda.
            </p>
          )}
        </div>
      </div>
    </Shell>
  );
}
