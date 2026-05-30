import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { CashCloseForm } from "@/components/CashCloseForm";
import { closeSession } from "../../actions";

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

  const [{ data: session }, { data: movs }] = await Promise.all([
    supabase
      .from("cash_sessions")
      .select("id, opening_amount, status, cash_drawers(name)")
      .eq("id", params.id)
      .single(),
    supabase
      .from("cash_movements")
      .select("direction, amount")
      .eq("session_id", params.id),
  ]);

  if (!session) notFound();
  if (session.status !== "open") {
    redirect("/caixa");
  }

  const drawerNameRaw =
    (session as unknown as { cash_drawers: { name: string } | null })
      .cash_drawers?.name || "—";
  const drawerName = DRAWER_LABEL[drawerNameRaw] || drawerNameRaw;

  const ins = (movs || [])
    .filter((m) => m.direction === "in")
    .reduce((s, m) => s + Number(m.amount), 0);
  const outs = (movs || [])
    .filter((m) => m.direction === "out")
    .reduce((s, m) => s + Number(m.amount), 0);

  return (
    <Shell>
      <TopBar title="Fechar caixa" subtitle={drawerName} backHref="/caixa" />
      <div className="mt-2 px-4">
        <CashCloseForm
          sessionId={session.id}
          openingAmount={Number(session.opening_amount)}
          inflows={ins}
          outflows={outs}
          action={closeSession}
        />
      </div>
    </Shell>
  );
}
