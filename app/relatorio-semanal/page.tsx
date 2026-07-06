import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { DataErrorCard } from "@/components/ui/DataErrorCard";
import { CopyWhatsAppButton } from "@/components/CopyWhatsAppButton";
import { getAuthUser, getCurrentProfile, roleLabel } from "@/lib/profile";
import { brl, brlSplit } from "@/lib/format";
import {
  getWeeklyReport,
  buildWhatsAppText,
  normalizeWeekParam,
  shiftDays,
  dayLabel,
  type ReportDay,
} from "@/lib/weekly-report";

export const dynamic = "force-dynamic";

export default async function RelatorioSemanalPage({
  searchParams,
}: {
  searchParams: { semana?: string };
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/");

  const weekStart = normalizeWeekParam(searchParams.semana);
  const report = await getWeeklyReport(weekStart);
  const whatsText = buildWhatsAppText(report);
  const split = brlSplit(report.faturamentoTotal);
  const maxDay = Math.max(...report.days.map((d) => d.faturamento ?? 0), 0);

  // navegação: › só até a semana corrente
  const canGoNext = !report.isCurrentWeek;

  return (
    <Shell>
      <TopBar
        title="Relatório semanal"
        subtitle="ter → seg · pronto pro WhatsApp"
        role={roleLabel(profile)}
        backHref="/painel"
      />

      <div className="px-4">
        {/* HERO — semana + faturamento */}
        <section className="relative mt-2 overflow-hidden rounded-hero p-5 px-5 text-white shadow-glow bg-cyan-hero reveal d2">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"
          />
          <div className="flex items-center justify-between">
            <Link
              href={`?semana=${shiftDays(report.weekStart, -7)}`}
              aria-label="Semana anterior"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-base font-bold"
            >
              ‹
            </Link>
            <div className="text-center text-xs font-semibold tracking-[0.5px] opacity-85">
              {dayLabel(report.weekStart)} → {dayLabel(report.weekEnd)}
              {report.isCurrentWeek && (
                <span className="ml-1 rounded-full bg-brandyellow px-1.5 py-0.5 text-[10px] font-bold text-navy">
                  em andamento
                </span>
              )}
            </div>
            {canGoNext ? (
              <Link
                href={`?semana=${shiftDays(report.weekStart, 7)}`}
                aria-label="Próxima semana"
                className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-base font-bold"
              >
                ›
              </Link>
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-base font-bold opacity-30">
                ›
              </span>
            )}
          </div>
          <div className="mt-1 font-display text-[36px] font-extrabold leading-none tracking-[-1.5px]">
            {split.int}
            <span className="text-[22px] opacity-80">{split.cents}</span>
          </div>
          <div className="mt-1 text-xs opacity-90">
            faturamento Saipos · {report.diasComVenda}{" "}
            {report.diasComVenda === 1 ? "dia com venda" : "dias com venda"}
          </div>
        </section>

        {report.error && (
          <div className="mt-3">
            <DataErrorCard />
          </div>
        )}

        {/* POR DIA */}
        <section className="mt-3 rounded-card bg-white p-4 shadow-card reveal d3">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.5px] text-muted">
            Faturamento por dia
          </div>
          <div className="space-y-2">
            {report.days.map((d) => (
              <DayRow key={d.date} d={d} max={maxDay} />
            ))}
          </div>
        </section>

        {/* TOTAIS */}
        <section className="mt-3 rounded-card bg-white p-4 shadow-card reveal d3">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.5px] text-muted">
            Custos e pendências da semana
          </div>
          <div className="space-y-1.5 text-sm">
            <TotalRow label="🛵 Motoboys" value={brl(report.motoTotal)} />
            <TotalRow label="👷 Extras pagos" value={brl(report.extrasPagos)} />
            <TotalRow
              label="👷 Extras pendentes"
              value={brl(report.extrasPendentes)}
              tone={report.extrasPendentes > 0 ? "warn" : undefined}
            />
            <TotalRow
              label="💵 Quebra de caixa"
              value={`${report.quebraCaixa < 0 ? "−" : ""}${brl(Math.abs(report.quebraCaixa))}`}
              tone={report.quebraCaixa < 0 ? "danger" : undefined}
            />
          </div>
          {report.diasSemFechamento.length > 0 && (
            <div className="mt-3 rounded-xl bg-warn-bg px-3 py-2 text-xs font-semibold text-warn">
              ⚠ {report.diasSemFechamento.length}{" "}
              {report.diasSemFechamento.length === 1 ? "dia" : "dias"} sem
              fechamento: {report.diasSemFechamento.join(", ")}
            </div>
          )}
        </section>

        {/* TEXTO PRO WHATSAPP */}
        <section className="mt-3 rounded-card bg-white p-4 shadow-card reveal d4">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.5px] text-muted">
            Prévia do texto
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-appbg p-3 text-[12px] leading-relaxed text-navy">
            {whatsText}
          </pre>
          <CopyWhatsAppButton text={whatsText} />
        </section>
      </div>
    </Shell>
  );
}

function DayRow({ d, max }: { d: ReportDay; max: number }) {
  const pct = max > 0 && d.faturamento != null ? Math.max((d.faturamento / max) * 100, 4) : 0;
  const isPeak = d.faturamento != null && d.faturamento === max && max > 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-[74px] shrink-0 text-[11px] font-bold text-muted">{d.label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded-full bg-line/50">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${
            isPeak ? "bg-brandyellow" : "bg-cyan"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-[86px] shrink-0 text-right text-[12px] font-bold tabular-nums text-navy">
        {d.faturamento != null ? brl(d.faturamento) : "—"}
      </span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "danger";
}) {
  const color = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-navy";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
