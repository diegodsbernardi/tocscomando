import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { BarChart, type Bar } from "@/components/ui/Charts";
import { brl } from "@/lib/format";
import { fmtDiaCurto, listarDias, resolverPeriodo } from "@/lib/periodo";
import { getFaturamentoPorDia } from "@/lib/faturamento";
import { getCurrentProfile } from "@/lib/profile";
import { MIN_DAILY_PAYMENT } from "@/lib/motoboys";

export const dynamic = "force-dynamic";

const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Acima disso, o custo de freela no dia pesa demais sobre a venda. */
const ALERTA_PCT = 12;

export default async function FreelasXFaturamentoPage({
  searchParams,
}: {
  searchParams: { p?: string; de?: string; ate?: string; motos?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/extras");

  const periodo = resolverPeriodo({ p: searchParams.p ?? "mes", de: searchParams.de, ate: searchParams.ate });
  const comMotos = searchParams.motos === "1";

  const [{ data: extrasRaw }, { data: shiftsRaw }, faturamento] = await Promise.all([
    supabase
      .from("extra_payments")
      .select("work_date, amount, paid, employees(name, centro_custo)")
      .gte("work_date", periodo.start)
      .lte("work_date", periodo.end),
    supabase
      .from("motoboy_shifts")
      .select("work_date, motoboy_shift_rides(rides_count, fee_at_time)")
      .gte("work_date", periodo.start)
      .lte("work_date", periodo.end),
    getFaturamentoPorDia(periodo.start, periodo.endExclusive),
  ]);

  const extras = ((extrasRaw || []) as unknown as {
    work_date: string;
    amount: number;
    paid: boolean;
    employees: { name: string; centro_custo: "cozinha" | "atendimento" } | null;
  }[]);

  const custoExtrasDia = new Map<string, number>();
  const pessoasDia = new Map<string, number>();
  for (const e of extras) {
    custoExtrasDia.set(e.work_date, (custoExtrasDia.get(e.work_date) ?? 0) + Number(e.amount));
    pessoasDia.set(e.work_date, (pessoasDia.get(e.work_date) ?? 0) + 1);
  }

  const custoMotosDia = new Map<string, number>();
  for (const s of ((shiftsRaw || []) as unknown as {
    work_date: string;
    motoboy_shift_rides: { rides_count: number; fee_at_time: number }[];
  }[])) {
    const bruto = (s.motoboy_shift_rides || []).reduce(
      (a, r) => a + Number(r.rides_count) * Number(r.fee_at_time),
      0,
    );
    custoMotosDia.set(
      s.work_date,
      (custoMotosDia.get(s.work_date) ?? 0) + Math.max(bruto, MIN_DAILY_PAYMENT),
    );
  }

  const linhas = listarDias(periodo)
    .map((d) => {
      const fat = faturamento.get(d);
      const extrasDia = custoExtrasDia.get(d) ?? 0;
      const motosDia = custoMotosDia.get(d) ?? 0;
      const custo = extrasDia + (comMotos ? motosDia : 0);
      const venda = fat?.total ?? 0;
      return {
        date: d,
        dow: DOW[new Date(`${d}T12:00:00`).getDay()],
        venda,
        fonte: fat?.fonte ?? ("sem-dado" as const),
        extras: extrasDia,
        motos: motosDia,
        custo,
        pessoas: pessoasDia.get(d) ?? 0,
        pct: venda > 0 ? (custo / venda) * 100 : null,
      };
    })
    .filter((l) => l.venda > 0 || l.custo > 0)
    .reverse(); // mais recente primeiro

  const tot = linhas.reduce(
    (a, l) => {
      a.venda += l.venda;
      a.extras += l.extras;
      a.motos += l.motos;
      a.custo += l.custo;
      a.pessoas += l.pessoas;
      return a;
    },
    { venda: 0, extras: 0, motos: 0, custo: 0, pessoas: 0 },
  );
  const pctTotal = tot.venda > 0 ? (tot.custo / tot.venda) * 100 : null;
  const diasComVenda = linhas.filter((l) => l.venda > 0);
  const semSaipos = linhas.filter((l) => l.fonte === "caixa").length;

  const barras: Bar[] = linhas
    .slice()
    .reverse()
    .map((l) => ({
      label: fmtDiaCurto(l.date).slice(0, 5),
      value: l.pct != null ? Number(l.pct.toFixed(1)) : 0,
      hint: `${fmtDiaCurto(l.date)}: ${brl(l.custo)} de freela sobre ${brl(l.venda)}`,
      peak: l.pct != null && l.pct >= ALERTA_PCT,
    }));

  // Dia mais caro em % (só entre dias com venda registrada)
  const pior = diasComVenda
    .filter((l) => l.pct != null)
    .sort((a, b) => (b.pct as number) - (a.pct as number))[0];

  const qsMotos = (v: string) => {
    const sp = new URLSearchParams();
    sp.set("p", periodo.key);
    if (periodo.key === "custom") {
      sp.set("de", periodo.start);
      sp.set("ate", periodo.end);
    }
    sp.set("motos", v);
    return `?${sp.toString()}`;
  };

  return (
    <Shell>
      <TopBar
        title="Freela x Faturamento"
        subtitle="quanto da venda foi pro extra"
        backHref="/extras"
      />

      <div className="px-4">
        <PeriodoFilter periodo={periodo} extras={{ motos: comMotos ? "1" : undefined }} />

        <section className="relative mt-3 overflow-hidden rounded-hero p-5 px-5 text-white shadow-glow bg-cyan-hero reveal d2">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"
          />
          <div className="text-xs font-semibold tracking-[0.5px] opacity-85">
            {periodo.titulo} · {periodo.label}
          </div>
          <div className="mt-0.5 font-display text-[40px] font-extrabold leading-none tracking-[-1px]">
            {pctTotal != null ? `${pctTotal.toFixed(1)}%` : "—"}
          </div>
          <div className="mt-1 text-[13px] opacity-90">
            {brl(tot.custo)} de {comMotos ? "freela + moto" : "freela"} sobre {brl(tot.venda)} vendidos
          </div>
          <div className="mt-3 flex border-t border-white/20 pt-3">
            <SplitCol label="EXTRAS" value={brl(tot.extras)} />
            <SplitCol label="MOTOS" value={brl(tot.motos)} />
            <SplitCol label="DIÁRIAS" value={String(tot.pessoas)} />
          </div>
        </section>

        <div className="mt-3 flex gap-2 reveal d3">
          <Seg href={qsMotos("0")} label="Só extras" active={!comMotos} />
          <Seg href={qsMotos("1")} label="Extras + motoboys" active={comMotos} />
        </div>

        <section className="mt-3 rounded-card bg-white p-4 shadow-card reveal d3">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.5px] text-muted">
            % da venda gasta em {comMotos ? "freela + moto" : "freela"} · por dia
          </div>
          <BarChart bars={barras} />
          <p className="mt-2 text-[10px] text-muted">
            Amarelo = dia acima de {ALERTA_PCT}% da venda.
          </p>
        </section>

        {pior && pior.pct != null && (
          <section
            className={`mt-3 flex items-start gap-3 rounded-card p-4 reveal d4 ${
              pior.pct >= ALERTA_PCT ? "bg-warn-bg" : "bg-ok-bg"
            }`}
          >
            <span className="text-lg">{pior.pct >= ALERTA_PCT ? "💡" : "✅"}</span>
            <p
              className={`text-[13px] font-semibold leading-snug ${
                pior.pct >= ALERTA_PCT ? "text-warn" : "text-ok"
              }`}
            >
              {pior.pct >= ALERTA_PCT
                ? `Pior dia: ${fmtDiaCurto(pior.date)} (${pior.dow}) — ${pior.pct.toFixed(1)}% da venda foi pra ${pior.pessoas} freela${pior.pessoas === 1 ? "" : "s"}. Venda de ${brl(pior.venda)} não sustentou o reforço.`
                : `Nenhum dia passou de ${ALERTA_PCT}% da venda. Pior foi ${fmtDiaCurto(pior.date)} com ${pior.pct.toFixed(1)}%.`}
            </p>
          </section>
        )}

        {semSaipos > 0 && (
          <p className="mt-3 rounded-card bg-surface p-3 text-[11px] text-muted">
            ⓘ {semSaipos} dia(s) sem captura do Saipos — usei o faturamento do fechamento de caixa.
          </p>
        )}

        <h3 className="mb-2 mt-5 px-1 text-[11px] font-bold uppercase tracking-[0.5px] text-muted">
          Dia a dia
        </h3>
        <div className="overflow-hidden rounded-card bg-white shadow-card reveal d5">
          <div className="flex items-center gap-2 border-b border-line bg-surface px-[15px] py-2 text-[10px] font-bold uppercase tracking-wider text-muted">
            <span className="w-16 shrink-0">Dia</span>
            <span className="flex-1 text-right">Venda</span>
            <span className="w-20 text-right">Freela</span>
            <span className="w-12 text-right">%</span>
          </div>
          {linhas.length === 0 && (
            <p className="p-6 text-center text-sm text-muted">Sem dados no período.</p>
          )}
          {linhas.map((l) => (
            <div key={l.date} className="flex items-center gap-2 border-b border-line px-[15px] py-2.5 last:border-0">
              <span className="w-16 shrink-0 text-[12px] font-bold text-navy">
                {fmtDiaCurto(l.date).slice(0, 5)}
                <span className="ml-1 font-medium text-muted">{l.dow}</span>
              </span>
              <span className="flex-1 text-right text-[12px] tabular-nums text-navy">
                {l.venda > 0 ? brl(l.venda) : <span className="text-muted">—</span>}
              </span>
              <span className="w-20 text-right text-[12px] tabular-nums text-navy">
                {brl(l.custo)}
                {l.pessoas > 0 && (
                  <span className="ml-1 text-[10px] text-muted">{l.pessoas}p</span>
                )}
              </span>
              <span
                className={`w-12 text-right text-[12px] font-bold tabular-nums ${
                  l.pct == null ? "text-muted" : l.pct >= ALERTA_PCT ? "text-warn" : "text-ok"
                }`}
              >
                {l.pct != null ? `${l.pct.toFixed(1)}%` : "—"}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted">
          Venda vem do Saipos (último snapshot do dia por loja); quando falta, cai no fechamento de
          caixa. Custo de moto usa o piso de {brl(MIN_DAILY_PAYMENT)}/dia quando as corridas não
          alcançam.
        </p>
      </div>
    </Shell>
  );
}

function SplitCol({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1">
      <div className="text-[11px] font-semibold opacity-80">{label}</div>
      <div className="mt-0.5 text-[17px] font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Seg({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      className={`flex-1 rounded-xl border-[1.5px] py-2.5 text-center text-[13px] font-bold transition ${
        active ? "border-navy bg-navy text-white" : "border-line bg-white text-muted"
      }`}
    >
      {label}
    </a>
  );
}
