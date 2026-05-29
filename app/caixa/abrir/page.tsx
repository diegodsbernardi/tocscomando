import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CashOpenForm } from "@/components/CashOpenForm";
import { openSession } from "../actions";

export const dynamic = "force-dynamic";

type Drawer = { id: string; name: string };

export default async function AbrirCaixaPage({
  searchParams,
}: {
  searchParams: { drawer?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: drawers } = await supabase
    .from("cash_drawers")
    .select("id, name")
    .eq("active", true)
    .order("name");
  const list = (drawers || []) as Drawer[];
  const preselected =
    searchParams.drawer && list.find((d) => d.id === searchParams.drawer)
      ? searchParams.drawer
      : list[0]?.id || "";

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Abrir caixa</h1>
        <Link
          href="/caixa"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </Link>
      </header>

      <CashOpenForm
        drawers={list}
        preselectedDrawerId={preselected}
        action={openSession}
      />
    </main>
  );
}
