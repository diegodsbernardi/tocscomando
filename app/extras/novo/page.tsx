import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { ExtraPicker } from "@/components/ExtraPicker";
import { createExtra } from "../actions";
import { isoWeekRange, isoToday } from "@/lib/vinculo";

export const dynamic = "force-dynamic";

export default async function NovoExtraPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const week = isoWeekRange(isoToday());

  const [{ data: employees }, { data: weekRows }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, name, centro_custo, phone")
      .eq("active", true)
      .order("centro_custo")
      .order("name"),
    supabase
      .from("extra_payments")
      .select("employee_id")
      .gte("work_date", week.start)
      .lte("work_date", week.end),
  ]);

  const weekCount: Record<string, number> = {};
  for (const r of weekRows || []) {
    const id = (r as { employee_id: string }).employee_id;
    weekCount[id] = (weekCount[id] || 0) + 1;
  }

  return (
    <Shell>
      <TopBar title="Novo extra" subtitle="quem trabalhou hoje?" backHref="/extras" />
      <div className="mt-2 px-4">
        <ExtraPicker
          employees={(employees || []).map((e) => ({
            id: e.id,
            name: e.name,
            centro_custo: e.centro_custo as "atendimento" | "cozinha",
            phone: e.phone,
            weekCount: weekCount[e.id] || 0,
          }))}
          action={createExtra}
        />
      </div>
    </Shell>
  );
}
