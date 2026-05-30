import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewShiftForm } from "@/components/NewShiftForm";
import { createShift } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NovoTurnoPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: motoboys } = await supabase
    .from("motoboys")
    .select("id, name")
    .eq("active", true)
    .order("name");

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Novo turno</h1>
        <Link
          href="/motoboys"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </Link>
      </header>

      <NewShiftForm motoboys={(motoboys || []) as { id: string; name: string }[]} action={createShift} />
    </main>
  );
}
