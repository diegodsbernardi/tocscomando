import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Drawer = { id: string; name: string };

function brl(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function timeBR(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export async function CashStatusCard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: drawersData }, { data: openData }] = await Promise.all([
    supabase.from("cash_drawers").select("id, name").eq("active", true).order("name"),
    supabase
      .from("cash_sessions")
      .select("drawer_id, opening_amount, opened_at")
      .eq("status", "open"),
  ]);

  const drawers = (drawersData || []) as Drawer[];
  if (drawers.length === 0) return null;

  const openByDrawer = new Map<string, { opening_amount: number; opened_at: string }>();
  for (const o of openData || []) {
    openByDrawer.set(o.drawer_id, {
      opening_amount: Number(o.opening_amount),
      opened_at: o.opened_at,
    });
  }

  return (
    <Link
      href="/caixa"
      aria-label="Ver caixas"
      className="block rounded-2xl bg-white p-5 shadow transition hover:shadow-md"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Caixas
        </span>
        <span className="text-xs text-slate-400">ver →</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {drawers.map((d) => {
          const open = openByDrawer.get(d.id);
          return (
            <div key={d.id}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {d.name}
              </p>
              {open ? (
                <>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-700">
                    {brl(open.opening_amount)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    aberto {timeBR(open.opened_at)}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-0.5 text-xl font-bold text-slate-400">—</p>
                  <p className="text-[11px] text-slate-500">fechado</p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Link>
  );
}
