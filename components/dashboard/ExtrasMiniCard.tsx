import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { brl } from "@/lib/format";

function monthRange() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const next = new Date(y, m + 1, 1);
  const end = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

function monthLabel() {
  return new Date().toLocaleDateString("pt-BR", { month: "long" });
}

export async function ExtrasMiniCard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { start, end } = monthRange();
  const { data } = await supabase
    .from("extra_payments")
    .select("amount, paid")
    .gte("work_date", start)
    .lt("work_date", end);

  const list = data || [];
  const pagar = list.filter((e) => !e.paid).reduce((a, e) => a + Number(e.amount), 0);
  const pago = list.filter((e) => e.paid).reduce((a, e) => a + Number(e.amount), 0);

  return (
    <Link
      href="/extras"
      className="reveal d5 mx-4 mt-4 block rounded-card bg-white p-4 px-[18px] shadow-card transition hover:shadow-glow"
    >
      <div className="mb-3 flex items-center justify-between">
        <strong className="text-sm font-bold capitalize">
          Extras de {monthLabel()}
        </strong>
        <span className="text-xs font-semibold text-cyan">ver tudo →</span>
      </div>
      <div className="flex gap-6">
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-danger">
            A PAGAR
          </div>
          <div className="mt-0.5 font-display text-lg font-bold tabular-nums">
            {brl(pagar)}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-ok">
            PAGO
          </div>
          <div className="mt-0.5 font-display text-lg font-bold tabular-nums">
            {brl(pago)}
          </div>
        </div>
      </div>
    </Link>
  );
}
