import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { getSaiposSuggestion } from "@/lib/saipos";
import { todayISO, startOfDayISO } from "@/lib/dates";
import { brl, brlSplit } from "@/lib/format";

const DRAWER_LABEL: Record<string, string> = { DLV: "Delivery", LTDA: "Salão" };

/**
 * Hero do OPERADOR: foco na rotina do turno dele — status do caixa e valor
 * esperado na gaveta agora — no lugar do faturamento total (admin-only).
 */
export async function OperatorHero() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  let sessionQuery = supabase
    .from("cash_sessions")
    .select("id, opened_at, opening_amount, cash_drawers(name)")
    .eq("work_date", todayISO())
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1);
  if (profile?.default_drawer_id) {
    sessionQuery = sessionQuery.eq("drawer_id", profile.default_drawer_id);
  }

  const [{ data: sessions }, saipos, { count: cuponsHoje }] = await Promise.all([
    sessionQuery,
    getSaiposSuggestion(),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDayISO()),
  ]);

  const session = (sessions || [])[0] as unknown as
    | { id: string; opened_at: string; opening_amount: number; cash_drawers: { name: string } | null }
    | undefined;

  if (!session) {
    return (
      <section className="reveal d2 relative mx-4 mt-3 overflow-hidden rounded-hero bg-cyan-hero p-[22px] text-white shadow-glow">
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <span className="text-xs font-semibold tracking-[1.5px] opacity-85">SEU TURNO</span>
        <p className="mt-2 text-[15px] font-semibold leading-snug">
          Nenhum caixa aberto ainda.
        </p>
        <Link
          href="/caixa/abrir"
          className="mt-4 block min-h-[44px] rounded-xl bg-brandyellow py-3 text-center text-[15px] font-bold text-navy"
        >
          Abrir o caixa
        </Link>
      </section>
    );
  }

  const { data: movs } = await supabase
    .from("cash_movements")
    .select("direction, amount")
    .eq("session_id", session.id);

  const ins = (movs || []).filter((m) => m.direction === "in").reduce((a, m) => a + Number(m.amount), 0);
  const outs = (movs || []).filter((m) => m.direction === "out").reduce((a, m) => a + Number(m.amount), 0);
  const esperado =
    Number(session.opening_amount) + ins - outs + (saipos?.cash_sales ?? 0);
  const split = brlSplit(esperado);

  const drawerName = DRAWER_LABEL[session.cash_drawers?.name || ""] || session.cash_drawers?.name || "Caixa";
  const abertoAs = new Date(session.opened_at).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="reveal d2 relative mx-4 mt-3 overflow-hidden rounded-hero bg-cyan-hero p-[22px] pb-[18px] text-white shadow-glow">
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-[1.5px] opacity-85">
          CAIXA {drawerName.toUpperCase()}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brandyellow px-2.5 py-1 text-[11px] font-bold text-navy">
          <span className="live-dot h-[7px] w-[7px] rounded-full bg-navy" />
          aberto às {abertoAs}
        </span>
      </div>

      <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider opacity-85">
        Esperado na gaveta agora
      </div>
      <div className="font-display text-[40px] font-extrabold leading-none tracking-[-1.5px]">
        {split.int}
        <span className="text-[24px] opacity-80">{split.cents}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
        <MiniStat label="Abertura" value={brl(Number(session.opening_amount))} />
        <MiniStat label="Mov. líquido" value={`${ins - outs >= 0 ? "+" : "−"}${brl(Math.abs(ins - outs))}`} />
        <MiniStat label="Cupons hoje" value={String(cuponsHoje ?? 0)} />
      </div>
      {saipos && (
        <p className="mt-3 text-[11px] opacity-75">
          Inclui {brl(saipos.cash_sales)} de vendas em dinheiro (Saipos).
        </p>
      )}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.14] px-2 py-[10px]">
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-85">{label}</div>
      <div className="mt-0.5 text-[14px] font-bold tabular-nums">{value}</div>
    </div>
  );
}
