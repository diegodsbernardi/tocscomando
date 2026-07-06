import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { brl, brlSplit } from "@/lib/format";
import { getCurrentProfile, roleLabel } from "@/lib/profile";
import { getPainelData, type DayPoint } from "@/lib/painel-stats";
import { getCashAlerts, DIAS_RECORRENTE, type DrawerAlert } from "@/lib/cash-alerts";

export const dynamic = "force-dynamic";

function dateBR(iso: string, opts: Intl.DateTimeFormatOptions) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", opts);
}

export default async function PainelPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/");

  const [d, cashAlerts] = await Promise.all([getPainelData(), getCashAlerts()]);
  const split = brlSplit(d.weekFaturamento);
  const deltaTone =
    d.weekDeltaPct == null
      ? "neutral"
      : d.weekDeltaPct >= 0
        ? "up"
        : "down";

  const mixTotal = d.mixCredito + d.mixDebito + d.mixPix;
  const pct = (n: number) =>
    mixTotal > 0 ? Math.round((n / mixTotal) * 100) : 0;

  return (
    <Shell>
      <TopBar
        title="Painel"
        subtitle="visão geral · admin"
        role={roleLabel(profile)}
        backHref="/"
      />

      <div className="px-4">
        {/* HERO — semana atual + delta */}
        <section className="relative mt-2 overflow-hidden rounded-hero p-5 px-5 text-white shadow-glow bg-cyan-hero reveal d2">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-[1.2px] opacity-85">
              FATURAMENTO DA SEMANA
            </span>
            {d.weekDeltaPct != null && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  deltaTone === "up"
                    ? "bg-brandyellow text-navy"
                    : "bg-white/20 text-white"
                }`}
              >
                {deltaTone === "up" ? "▲" : "▼"}{" "}
                {Math.abs(d.weekDeltaPct).toFixed(1)}% vs sem. ant.
              </span>
            )}
          </div>
          <div className="mt-1 font-display text-[40px] font-extrabold leading-none tracking-[-1.5px]">
            {split.int}
            <span className="text-[24px] opacity-80">{split.cents}</span>
          </div>
          <div className="mt-1 text-xs opacity-90">
            {dateBR(d.weekStart, { day: "2-digit", month: "short" })} →{" "}
            {dateBR(d.weekEnd, { day: "2-digit", month: "short" })} · {d.weekCupons}{" "}
            {d.weekCupons === 1 ? "cupom" : "cupons"}
          </div>
          <div className="mt-3 text-xs opacity-85">
            Semana anterior: <span className="font-bold">{brl(d.prevWeekFaturamento)}</span>
          </div>
        </section>

        {/* CHART 14 dias */}
        <section className="mt-3 rounded-card bg-white p-4 shadow-card reveal d3">
          <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-[0.5px] text-muted">
            <span>Últimos 14 dias</span>
            <span className="text-muted/70 normal-case tracking-normal">
              em reais
            </span>
          </div>
          <Chart points={d.last14} />
        </section>

        {/* CUSTOS DO MÊS */}
        <h3 className="mb-2 mt-5 px-1 text-[11px] font-bold uppercase tracking-[0.5px] text-muted">
          Custos diretos · {d.monthLabel}
        </h3>
        <div className="grid grid-cols-3 gap-2.5 reveal d3">
          <CustCard label="Motoboys" value={brl(d.monthCustoMotos)} />
          <CustCard label="Extras" value={brl(d.monthCustoExtras)} />
          <CustCard
            label="Quebra caixa"
            value={brl(d.monthDiferencaCaixa)}
            tone={d.monthDiferencaCaixa < 0 ? "danger" : d.monthDiferencaCaixa > 0 ? "warn" : "ok"}
          />
        </div>

        {cashAlerts.drawers.length > 0 && (
          <section className="mt-2.5 rounded-card bg-white p-4 shadow-card reveal d4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.5px] text-muted">
                Quebra de caixa · últimos {cashAlerts.lookbackDays} dias
              </span>
              {cashAlerts.hasAlert && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    cashAlerts.drawers.some((dr) => dr.grave)
                      ? "bg-danger-bg text-danger"
                      : "bg-warn-bg text-warn"
                  }`}
                >
                  {cashAlerts.drawers.some((dr) => dr.grave)
                    ? "GRAVE"
                    : "RECORRENTE"}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {cashAlerts.drawers.map((dr) => (
                <QuebraRow key={dr.drawerId} alert={dr} />
              ))}
            </div>
            {!cashAlerts.hasAlert && (
              <p className="mt-2 text-[11px] text-muted">
                Nenhuma caixa com quebra recorrente ({DIAS_RECORRENTE}+ dias no
                período).
              </p>
            )}
          </section>
        )}

        <section className="mt-3 rounded-card bg-navy p-4 text-white shadow-glow reveal d4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold opacity-80">
              Custo direto total do mês
            </span>
            <span className="font-display text-[22px] font-extrabold tabular-nums">
              {brl(d.monthCustoTotal)}
            </span>
          </div>
          {d.monthFaturamento > 0 && (
            <div className="mt-1 text-[11px] opacity-80">
              {((d.monthCustoTotal / d.monthFaturamento) * 100).toFixed(1)}% do
              faturamento ({brl(d.monthFaturamento)})
            </div>
          )}
        </section>

        {/* MIX DE PAGAMENTO */}
        <h3 className="mb-2 mt-5 px-1 text-[11px] font-bold uppercase tracking-[0.5px] text-muted">
          Mix de pagamento · {d.monthLabel}
        </h3>
        <section className="rounded-card bg-white p-4 shadow-card reveal d4 space-y-2.5">
          <MixRow label="Crédito" value={d.mixCredito} pct={pct(d.mixCredito)} />
          <MixRow label="Débito" value={d.mixDebito} pct={pct(d.mixDebito)} />
          <MixRow label="Pix" value={d.mixPix} pct={pct(d.mixPix)} />
        </section>

        {/* ATALHOS */}
        <h3 className="mb-2 mt-5 px-1 text-[11px] font-bold uppercase tracking-[0.5px] text-muted">
          Ir mais fundo
        </h3>
        <div className="grid grid-cols-2 gap-2 reveal d5">
          <Atalho href="/motoboys/historico" label="Entregas" hint="análise" />
          <Atalho href="/caixa" label="Caixa" hint="sessões" />
          <Atalho href="/extras" label="Extras" hint="freelancers" />
          <Atalho href="/historico" label="Cupons" hint="hoje" />
        </div>
      </div>
    </Shell>
  );
}

function Chart({ points }: { points: DayPoint[] }) {
  const max = Math.max(...points.map((p) => p.total), 0);
  return (
    <div className="flex h-[120px] items-end gap-1">
      {points.map((p) => {
        const height = max > 0 ? (p.total / max) * 100 : 0;
        const day = Number(p.date.split("-")[2]);
        const isPeak = p.total === max && max > 0;
        return (
          <div
            key={p.date}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            title={`${p.date}: ${p.total > 0 ? p.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}`}
          >
            <div
              className={`w-full min-h-[3px] rounded-t-[5px] rounded-b-[2px] transition-[height] duration-500 ease-out ${
                isPeak ? "bg-brandyellow" : p.total > 0 ? "bg-cyan" : "bg-line"
              }`}
              style={{ height: `${height}%` }}
            />
            <span className="text-[9px] font-semibold text-muted">{day}</span>
          </div>
        );
      })}
    </div>
  );
}

function QuebraRow({ alert }: { alert: DrawerAlert }) {
  const tone = alert.grave
    ? "text-danger"
    : alert.recorrente
      ? "text-warn"
      : alert.acumulado < 0
        ? "text-navy"
        : "text-ok";
  const dot = alert.grave
    ? "bg-danger"
    : alert.recorrente
      ? "bg-warn"
      : "bg-ok";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 font-semibold text-navy">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
        {alert.drawerName}
      </span>
      <span className={`tabular-nums font-bold ${tone}`}>
        {brl(alert.acumulado)}{" "}
        <span className="text-[11px] font-normal text-muted">
          em {alert.diasComQuebra} {alert.diasComQuebra === 1 ? "dia" : "dias"}
        </span>
      </span>
    </div>
  );
}

function CustCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
}) {
  const colorClass =
    tone === "ok"
      ? "text-ok"
      : tone === "warn"
        ? "text-warn"
        : tone === "danger"
          ? "text-danger"
          : "text-navy";
  return (
    <div className="rounded-card bg-white p-3 shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-base font-bold leading-tight tabular-nums ${colorClass}`}
      >
        {value}
      </div>
    </div>
  );
}

function MixRow({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold text-navy">{label}</span>
        <span className="tabular-nums">
          {brl(value)}{" "}
          <span className="text-[11px] text-muted">({pct}%)</span>
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-cyan transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Atalho({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-card bg-white p-3 shadow-card transition hover:shadow-glow"
    >
      <div>
        <strong className="block text-sm font-bold text-navy">{label}</strong>
        <span className="text-[11px] text-muted">{hint}</span>
      </div>
      <span className="text-cyan">→</span>
    </Link>
  );
}
