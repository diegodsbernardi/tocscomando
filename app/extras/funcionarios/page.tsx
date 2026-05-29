import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmployeeForm } from "@/components/EmployeeForm";
import { EmployeeListItem } from "@/components/EmployeeListItem";

export const dynamic = "force-dynamic";

type Employee = {
  id: string;
  name: string;
  centro_custo: "atendimento" | "cozinha";
  active: boolean;
};

export default async function FuncionariosPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("employees")
    .select("id, name, centro_custo, active")
    .order("active", { ascending: false })
    .order("centro_custo")
    .order("name");

  const employees = (data || []) as Employee[];
  const atendimento = employees.filter((e) => e.centro_custo === "atendimento");
  const cozinha = employees.filter((e) => e.centro_custo === "cozinha");

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Funcionários</h1>
        <Link
          href="/extras"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Voltar
        </Link>
      </header>

      <EmployeeForm />

      <section className="mb-4">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Atendimento ({atendimento.length})
        </h2>
        <div className="space-y-2">
          {atendimento.map((e) => (
            <EmployeeListItem
              key={e.id}
              id={e.id}
              name={e.name}
              centro={e.centro_custo}
              active={e.active}
            />
          ))}
        </div>
      </section>

      <section className="mb-4">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cozinha ({cozinha.length})
        </h2>
        <div className="space-y-2">
          {cozinha.map((e) => (
            <EmployeeListItem
              key={e.id}
              id={e.id}
              name={e.name}
              centro={e.centro_custo}
              active={e.active}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
