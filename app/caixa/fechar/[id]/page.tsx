import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { CashCloseForm } from "@/components/CashCloseForm";
import { CashMovementForm } from "@/components/CashMovementForm";
import { CashMovementList, type Movement } from "@/components/CashMovementList";
import { closeSession } from "../../actions";
import { getLatestSaiposSnapshot } from "@/lib/saipos";
import { brl } from "@/lib/format";

export const dynamic = "force-dynamic";

const DRAWER_LABEL: Record<string, string> = {
  DLV: "Delivery",
  LTDA: "Salão",
};

export default async function FecharCaixaPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: session }, { data: movsRaw }] = await Promise.all([
    supabase
      .from("cash_sessions")
      .select("id, opening_amount, status, cash_drawers(name)")
      .eq("id", params.id)
      .single(),
    supabase
      .from("cash_movements")
      .select("id, direction, category, amount, note, created_at")
      .eq("session_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!session) notFound();
  if (session.status !== "open") {
    redirect("/caixa");
  }

  const movs: Movement[] = (movsRaw || []).map((m) => ({
    id: m.id,
    direction: m.direction as "in" | "out",
    category: m.category,
    amount: Number(m.amount),
    note: m.note,
    created_at: m.created_at,
  }));

  const drawerNameRaw =
    (session as unknown as { cash_drawers: { name: string } | null })
      .cash_drawers?.name || "—";
  const drawerName = DRAWER_LABEL[drawerNameRaw] || drawerNameRaw;

  const ins = movs.filter((m) => m.direction === "in").reduce((s, m) => s + m.amount, 0);
  const outs = movs.filter((m) => m.direction === "out").reduce((s, m) => s + m.amount, 0);

  // Tenta puxar snapshot do Saipos pra esse caixa, fallback no consolidado
  const drawerSnapshot = await getLatestSaiposSnapshot(drawerNameRaw);
  const fallbackSnapshot = drawerSnapshot ?? (await getLatestSaiposSnapshot(null));
  const suggestedCashSales = fallbackSnapshot?.cash_sales ?? null;
  const saiposCapturedAt = fallbackSnapshot?.captured_at ?? null;

  return (
    <Shell>
      <TopBar title="Fechar caixa" subtitle={drawerName} backHref="/caixa" />
      <div className="mt-2 space-y-4 px-4">

        {/* Movimentações da sessão — fica acima do fechamento pra ser o primeiro reflexo
            de "esqueci de registrar algo" antes de contar a gaveta */}
        <section className="rounded-card bg-white p-4 shadow-card">
          <div className="mb-1.5 flex items-center justify-between">
            <strong className="text-sm font-bold">Movimentações do dia</strong>
            <span className="text-[11px] font-semibold text-muted">
              saídas <span className="font-bold text-danger">−{brl(outs)}</span>
              {" · "}
              entradas <span className="font-bold text-ok">+{brl(ins)}</span>
            </span>
          </div>
          <p className="mb-3 text-[12px] leading-snug text-muted">
            Pagou um extra, motoboy, depósito ou alguém trouxe troco?
            {" "}<b className="text-navy">Registra aqui antes de contar</b> — senão vai aparecer
            como quebra de caixa.
          </p>
          <CashMovementList items={movs} />
          <div className="mt-3">
            <CashMovementForm sessionId={session.id} />
          </div>
        </section>

        <CashCloseForm
          sessionId={session.id}
          openingAmount={Number(session.opening_amount)}
          inflows={ins}
          outflows={outs}
          action={closeSession}
          suggestedCashSales={suggestedCashSales}
          saiposCapturedAt={saiposCapturedAt}
        />
      </div>
    </Shell>
  );
}
