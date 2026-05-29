import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function brl(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthStartEnd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const nextMonth = new Date(y, m + 1, 1);
  const end = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

export async function ExtrasPendingCard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { start, end } = monthStartEnd();

  const { data: pendentes } = await supabase
    .from("extra_payments")
    .select("amount")
    .eq("paid", false)
    .gte("work_date", start)
    .lt("work_date", end);

  const { data: pagosHoje } = await supabase
    .from("extra_payments")
    .select("amount, paid_amount")
    .eq("paid", true)
    .gte("paid_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

  const totalPendente = (pendentes || []).reduce((a, r) => a + Number(r.amount), 0);
  const countPendente = pendentes?.length ?? 0;
  const totalPagoHoje = (pagosHoje || []).reduce(
    (a, r) => a + Number(r.paid_amount ?? r.amount),
    0,
  );

  return (
    <Link
      href="/extras"
      aria-label="Ver extras"
      className="block rounded-2xl bg-white p-5 shadow transition hover:shadow-md"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Extras
        </span>
        <span className="text-xs text-slate-400">ver →</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
            A pagar (mês)
          </p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">
            {brl(totalPendente)}
          </p>
          <p className="text-[11px] text-slate-500">
            {countPendente} {countPendente === 1 ? "registro" : "registros"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            Pago hoje
          </p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">
            {brl(totalPagoHoje)}
          </p>
          <p className="text-[11px] text-slate-500">&nbsp;</p>
        </div>
      </div>
    </Link>
  );
}
