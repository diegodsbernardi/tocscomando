import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MotoboyForm } from "@/components/MotoboyForm";
import { MotoboyListItem } from "@/components/MotoboyListItem";

export const dynamic = "force-dynamic";

type Motoboy = { id: string; name: string; phone: string | null; active: boolean };

export default async function CadastroMotoboysPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("motoboys")
    .select("id, name, phone, active")
    .order("active", { ascending: false })
    .order("name");

  const list = (data || []) as Motoboy[];
  const active = list.filter((m) => m.active);
  const inactive = list.filter((m) => !m.active);

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Motoboys</h1>
        <Link
          href="/motoboys"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Voltar
        </Link>
      </header>

      <MotoboyForm />

      <section className="mb-4">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ativos ({active.length})
        </h2>
        <div className="space-y-2">
          {active.map((m) => (
            <MotoboyListItem
              key={m.id}
              id={m.id}
              initialName={m.name}
              initialPhone={m.phone}
              active={m.active}
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
            {inactive.map((m) => (
              <MotoboyListItem
                key={m.id}
                id={m.id}
                initialName={m.name}
                initialPhone={m.phone}
                active={m.active}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
