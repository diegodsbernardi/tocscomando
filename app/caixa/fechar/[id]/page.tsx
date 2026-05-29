import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CashCloseForm } from "@/components/CashCloseForm";
import { closeSession } from "../../actions";

export const dynamic = "force-dynamic";

export default async function FecharCaixaPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("cash_sessions")
    .select("id, opening_amount, status, cash_drawers(name)")
    .eq("id", params.id)
    .single();

  if (!session) notFound();
  if (session.status !== "open") {
    redirect("/caixa");
  }

  const drawerName =
    (session as unknown as { cash_drawers: { name: string } | null })
      .cash_drawers?.name || "—";

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Fechar caixa</h1>
          <p className="text-xs text-slate-500">{drawerName}</p>
        </div>
        <Link
          href="/caixa"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </Link>
      </header>

      <CashCloseForm
        sessionId={session.id}
        openingAmount={Number(session.opening_amount)}
        action={closeSession}
      />
    </main>
  );
}
