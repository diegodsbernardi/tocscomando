import { redirect } from "next/navigation";
import { startOfDayISO as spStartOfDay } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { DeleteReportButton } from "@/components/DeleteReportButton";
import { Shell } from "@/components/ui/Shell";
import { DataErrorCard } from "@/components/ui/DataErrorCard";
import { TopBar } from "@/components/ui/TopBar";

export const dynamic = "force-dynamic";

type Report = {
  id: string;
  credito: number;
  debito: number;
  pix: number;
  total: number;
  created_at: string;
};

function brl(n: number) {
  return Number(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function startOfDayISO() {
  return spStartOfDay();
}

export default async function HistoricoPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: reports, error: reportsError } = await supabase
    .from("reports")
    .select("id, credito, debito, pix, total, created_at")
    .eq("user_id", user.id)
    .gte("created_at", startOfDayISO())
    .order("created_at", { ascending: false });

  const list = (reports || []) as Report[];

  const totals = list.reduce(
    (acc, r) => {
      acc.credito += Number(r.credito);
      acc.debito += Number(r.debito);
      acc.pix += Number(r.pix);
      acc.total += Number(r.total);
      return acc;
    },
    { credito: 0, debito: 0, pix: 0, total: 0 },
  );

  return (
    <Shell>
      <TopBar title="Relatórios" subtitle="cupons de hoje" backHref="/" />
      <div className="px-4">
        {reportsError && <div className="mb-3"><DataErrorCard /></div>}

      <section className="mb-6 mt-2 space-y-2 rounded-2xl bg-white p-5 shadow">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Totais do dia
        </h2>
        <Row label="Crédito" value={totals.credito} />
        <Row label="Débito" value={totals.debito} />
        <Row label="Pix" value={totals.pix} />
        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="font-semibold text-navy">Total</span>
          <span className="text-xl font-bold text-cyan">
            {brl(totals.total)}
          </span>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Cupons de hoje ({list.length})
        </h2>
        {list.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-muted shadow">
            Nenhum relatório enviado hoje ainda.
          </p>
        )}
        {list.map((r) => (
          <article
            key={r.id}
            className="rounded-2xl bg-white p-4 shadow"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs text-muted">
                  {new Date(r.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-base font-bold tabular-nums text-cyan">
                  {brl(Number(r.total))}
                </span>
              </div>
              <DeleteReportButton id={r.id} />
            </div>
            <div className="flex justify-between text-sm tabular-nums text-muted">
              <span>Crédito {brl(Number(r.credito))}</span>
              <span>Débito {brl(Number(r.debito))}</span>
              <span>Pix {brl(Number(r.pix))}</span>
            </div>
          </article>
        ))}
      </section>
      </div>
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-navy">
      <span>{label}</span>
      <span className="font-medium">{brl(value)}</span>
    </div>
  );
}
