import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createExtra } from "../actions";
import { ExtraForm } from "@/components/ExtraForm";

export const dynamic = "force-dynamic";

export default async function NovoExtraPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, centro_custo")
    .eq("active", true)
    .order("centro_custo")
    .order("name");

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Novo extra</h1>
        <Link
          href="/extras"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </Link>
      </header>

      <ExtraForm employees={employees || []} action={createExtra} />
    </main>
  );
}
