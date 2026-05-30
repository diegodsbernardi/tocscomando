import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AreaForm } from "@/components/AreaForm";
import { AreaListItem } from "@/components/AreaListItem";

export const dynamic = "force-dynamic";

type Area = { id: string; name: string; fee: number; active: boolean };

export default async function BairrosPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("delivery_areas")
    .select("id, name, fee, active")
    .order("active", { ascending: false })
    .order("fee")
    .order("name");

  const list = (data || []) as Area[];
  const active = list.filter((a) => a.active);
  const inactive = list.filter((a) => !a.active);

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Bairros e taxas</h1>
        <Link
          href="/motoboys"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Voltar
        </Link>
      </header>

      <AreaForm />

      <section className="mb-4">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ativos ({active.length})
        </h2>
        <div className="space-y-2">
          {active.map((a) => (
            <AreaListItem
              key={a.id}
              id={a.id}
              name={a.name}
              initialFee={Number(a.fee)}
              active={a.active}
            />
          ))}
        </div>
      </section>

      {inactive.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Inativos ({inactive.length})
          </h2>
          <div className="space-y-2">
            {inactive.map((a) => (
              <AreaListItem
                key={a.id}
                id={a.id}
                name={a.name}
                initialFee={Number(a.fee)}
                active={a.active}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
