import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { VINCULO_LIMIT, levelForCount } from "@/lib/vinculo";

export const dynamic = "force-dynamic";

type Employee = {
  id: string;
  name: string;
  phone: string | null;
  centro_custo: "atendimento" | "cozinha";
};

type Payment = {
  work_date: string;
  amount: number;
};

function weekKey(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  const mondayBased = (base.getDay() + 6) % 7;
  const start = new Date(base);
  start.setDate(base.getDate() - mondayBased);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
}

function relativeWeekLabel(weekStart: string, todayWeekStart: string): string {
  const [y1, m1, d1] = weekStart.split("-").map(Number);
  const [y2, m2, d2] = todayWeekStart.split("-").map(Number);
  const a = new Date(y1, m1 - 1, d1);
  const b = new Date(y2, m2 - 1, d2);
  const diffDays = Math.round((b.getTime() - a.getTime()) / 86400000);
  const weeks = Math.round(diffDays / 7);
  if (weeks === 0) return "Esta semana";
  if (weeks === 1) return "Semana passada";
  return `${weeks} sem. atrás`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function PerfilExtraPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: emp }, { data: payments }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, name, phone, centro_custo")
      .eq("id", params.id)
      .single(),
    supabase
      .from("extra_payments")
      .select("work_date, amount")
      .eq("employee_id", params.id)
      .order("work_date", { ascending: false })
      .limit(120),
  ]);

  if (!emp) notFound();
  const employee = emp as Employee;
  const list = (payments || []) as Payment[];

  // Conta por semana
  const byWeek = new Map<string, number>();
  for (const p of list) {
    const wk = weekKey(p.work_date);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1);
  }

  // Top 6 semanas mais recentes
  const weeks = Array.from(byWeek.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 6);
  const todayWk = weekKey(todayISO());
  const max = Math.max(...weeks.map(([, c]) => c), VINCULO_LIMIT + 1);

  const initial = employee.name.charAt(0).toUpperCase();
  const phoneDigits = employee.phone?.replace(/\D/g, "") || "";

  return (
    <Shell>
      <TopBar title="Perfil" backHref="/extras" />

      <div className="px-4">
        <section className="rounded-card bg-white p-5 text-center shadow-card reveal d2">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-navy font-display text-2xl font-extrabold text-white">
            {initial}
          </div>
          <div className="mt-2.5 text-lg font-bold">{employee.name}</div>
          <div className="mt-1 flex items-center justify-center gap-2 text-sm text-muted">
            <span>📞</span>
            <span>{employee.phone || "sem telefone"}</span>
          </div>
          {employee.phone && (
            <div className="mt-3 flex justify-center gap-2">
              <a
                href={`tel:${phoneDigits}`}
                className="rounded-xl bg-line px-4 py-2 text-xs font-bold text-navy"
              >
                Ligar
              </a>
              <a
                href={`https://wa.me/55${phoneDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-ok-bg px-4 py-2 text-xs font-bold text-ok"
              >
                WhatsApp
              </a>
            </div>
          )}
          <div className="mt-3 inline-block rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: employee.centro_custo === "cozinha" ? "#FDE8EE" : "#E6F6FF",
              color: employee.centro_custo === "cozinha" ? "#E11D48" : "#14A0DC",
            }}
          >
            {employee.centro_custo === "cozinha" ? "Cozinha" : "Atendimento"}
          </div>
        </section>

        <h3 className="mb-2 mt-5 px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
          Vindas por semana
        </h3>
        <div className="space-y-2 reveal d3">
          {weeks.length === 0 && (
            <p className="rounded-card bg-white p-4 text-center text-sm text-muted shadow-card">
              Sem vindas registradas.
            </p>
          )}
          {weeks.map(([wk, count]) => {
            const lvl = levelForCount(count);
            const label = relativeWeekLabel(wk, todayWk);
            return (
              <div
                key={wk}
                className="flex items-center gap-3 rounded-card bg-white p-3 px-[15px] shadow-card"
              >
                <span className="w-28 flex-shrink-0 text-[13px] font-semibold">
                  {label}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
                  <div
                    className={`h-full rounded-full ${
                      lvl === "danger"
                        ? "bg-danger"
                        : lvl === "warn"
                          ? "bg-warn"
                          : "bg-cyan"
                    }`}
                    style={{ width: `${(count / max) * 100 || 3}%` }}
                  />
                </div>
                <span
                  className={`w-12 text-right text-sm font-bold tabular-nums ${
                    lvl === "danger"
                      ? "text-danger"
                      : lvl === "warn"
                        ? "text-warn"
                        : "text-navy"
                  }`}
                >
                  {count}x
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-4 px-1 text-[11px] text-muted">
          Limite atual: {VINCULO_LIMIT} vindas/semana. Pode ser ajustado depois.
        </p>
      </div>
    </Shell>
  );
}
