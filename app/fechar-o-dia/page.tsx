import Link from "next/link";
import { startOfDayISO as spStartOfDay } from "@/lib/dates";
import { todayISO as spToday } from "@/lib/dates";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDayData } from "@/lib/day-totals";
import { Shell } from "@/components/ui/Shell";
import { brl } from "@/lib/format";
import { MIN_DAILY_PAYMENT } from "@/lib/motoboys";
import { Logo } from "@/components/ui/Logo";
import { CloseDayFinishButton } from "@/components/CloseDayFinishButton";
import { getCurrentProfile, roleLabel, visibleDrawerFilter } from "@/lib/profile";

export const dynamic = "force-dynamic";

const STEPS = [
  { key: "motoboys", title: "Motoboys", icon: "🛵" },
  { key: "extras", title: "Extras", icon: "👤" },
  { key: "dinheiro", title: "Dinheiro", icon: "💵" },
  { key: "cartoes", title: "Cartões", icon: "💳" },
  { key: "conferir", title: "Conferir", icon: "✓" },
] as const;

function todayISO() {
  return spToday();
}

function startOfDayISO() {
  return spStartOfDay();
}

const DRAWER_LABEL: Record<string, string> = {
  DLV: "Delivery",
  LTDA: "Salão",
};

type Shift = {
  id: string;
  motoboy_id: string;
  motoboys: { name: string } | null;
  motoboy_shift_rides: { rides_count: number; fee_at_time: number }[];
};

type Extra = {
  id: string;
  amount: number;
  paid: boolean;
  employees: { name: string; centro_custo: "atendimento" | "cozinha" } | null;
};

type Session = {
  id: string;
  drawer_id: string;
  opening_amount: number;
  closing_amount: number | null;
  expected_amount: number | null;
  status: "open" | "closed";
  cash_drawers: { name: string } | null;
};

type Report = {
  id: string;
  credito: number;
  debito: number;
  pix: number;
  total: number;
  created_at: string;
};

export default async function FecharODiaPage({
  searchParams,
}: {
  searchParams: { passo?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  const scopedDrawerId = visibleDrawerFilter(profile);

  const stepIdx = Math.max(0, Math.min(4, parseInt(searchParams.passo || "0", 10) || 0));

  // Fonte única dos dados/totais do dia (lib/day-totals) — a tela mostra o
  // escopo do perfil; a action closeDay recalcula global no server.
  const { shifts, extras, sessions, reports, totals } = await getDayData(scopedDrawerId);
  const {
    moto_total: motoTotal,
    extras_pagos: extrasPagos,
    extras_pendentes: extrasPendentes,
    cash_total: cashTotal,
    cash_diff: cashDiff,
    card_total: cardTotal,
  } = totals;

  return (
    <Shell>
      {/* Header customizado com progress bar */}
      <header className="px-5 pt-5 reveal d1">
        <div className="mb-4 flex items-center gap-3">
          <Logo size={38} />
          <div className="flex-1 min-w-0">
            <strong className="block text-[15px] font-bold">Fechar o dia</strong>
            <small className="block text-xs text-muted">
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "short",
                day: "2-digit",
                month: "long",
                timeZone: "America/Sao_Paulo",
              })}
            </small>
          </div>
          {roleLabel(profile) && (
            <span className="rounded-full bg-navy px-3 py-[5px] text-[11px] font-bold text-white">
              {roleLabel(profile)}
            </span>
          )}
          <Link
            href="/"
            aria-label="Sair do wizard"
            className="grid h-[38px] w-[38px] place-items-center rounded-xl bg-white text-navy shadow-card"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Link>
        </div>

        {/* Progress bar */}
        <div className="mb-1.5 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-[5px] flex-1 rounded-full transition ${
                i < stepIdx
                  ? "bg-cyan"
                  : i === stepIdx
                    ? "bg-brandyellow"
                    : "bg-[#D7DFE9]"
              }`}
            />
          ))}
        </div>
        <div className="text-xs font-semibold text-muted">
          Passo {stepIdx + 1} de {STEPS.length}
        </div>
        <div className="font-display text-2xl font-extrabold tracking-[-0.5px]">
          {STEPS[stepIdx].title}
        </div>
      </header>

      <main className="px-4 pt-3 pb-24">
        {stepIdx === 0 && <StepMotoboys shifts={shifts} total={motoTotal} />}
        {stepIdx === 1 && (
          <StepExtras extras={extras} pagos={extrasPagos} pendentes={extrasPendentes} />
        )}
        {stepIdx === 2 && <StepDinheiro sessions={sessions} />}
        {stepIdx === 3 && (
          <StepCartoes reports={reports} cardTotal={cardTotal} />
        )}
        {stepIdx === 4 && (
          <StepConferir
            motoTotal={motoTotal}
            extrasPagos={extrasPagos}
            extrasPendentes={extrasPendentes}
            cashTotal={cashTotal}
            cashDiff={cashDiff}
            cardTotal={cardTotal}
            cashClosedCount={sessions.filter((s) => s.status === "closed").length}
          />
        )}
      </main>

      {/* Footer com nav */}
      <Footer stepIdx={stepIdx} />
    </Shell>
  );
}

function Footer({ stepIdx }: { stepIdx: number }) {
  const prev = stepIdx > 0 ? `?passo=${stepIdx - 1}` : null;
  const next = stepIdx < 4 ? `?passo=${stepIdx + 1}` : null;

  return (
    <div className="fixed bottom-[92px] left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-line bg-white/95 px-4 py-3.5 backdrop-blur">
      <div className="flex gap-2.5">
        {prev ? (
          <Link
            href={prev}
            className="flex-1 rounded-xl bg-line py-3.5 text-center text-[15px] font-bold text-navy"
          >
            Voltar
          </Link>
        ) : (
          <div className="flex-1" />
        )}
        {next ? (
          <Link
            href={next}
            className="flex-1 rounded-xl bg-cyan py-3.5 text-center text-[15px] font-bold text-white"
          >
            Próximo →
          </Link>
        ) : (
          <CloseDayFinishButton />
        )}
      </div>
    </div>
  );
}

// ----- STEP COMPONENTS -----
function StepMotoboys({ shifts, total }: { shifts: Shift[]; total: number }) {
  return (
    <div className="reveal d2">
      <p className="mb-3 px-1 text-[13px] leading-snug text-muted">
        Quem rodou hoje. Abaixo de R$100 o app completa pro piso e marca em vermelho.
      </p>
      {shifts.length === 0 ? (
        <EmptyStep
          msg="Nenhum turno lançado hoje."
          ctaHref="/motoboys/turno/novo"
          ctaLabel="+ Lançar primeiro turno"
        />
      ) : (
        <div className="rounded-card bg-white p-4 shadow-card">
          <div className="divide-y divide-line">
            {shifts.map((s) => {
              const rides = s.motoboy_shift_rides.reduce((a, r) => a + Number(r.rides_count), 0);
              const raw = s.motoboy_shift_rides.reduce(
                (a, r) => a + Number(r.rides_count) * Number(r.fee_at_time),
                0,
              );
              const effective = Math.max(raw, MIN_DAILY_PAYMENT);
              const belowMin = raw < MIN_DAILY_PAYMENT;
              return (
                <Link
                  key={s.id}
                  href={`/motoboys/turno/${s.id}`}
                  className="flex items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <strong className="block text-sm">{s.motoboys?.name || "—"}</strong>
                    <small className="text-[11px] text-muted">{rides} corridas</small>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-sm font-bold tabular-nums">
                      {brl(effective)}
                    </div>
                    {belowMin && (
                      <div className="mt-0.5 inline-block rounded bg-danger-bg px-1.5 py-0.5 text-[10px] font-bold text-danger">
                        piso R$100
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
          <Link
            href="/motoboys/turno/novo"
            className="mt-3 block rounded-xl border-[1.5px] border-dashed border-[#C6D3E0] py-2.5 text-center text-xs font-bold text-cyan"
          >
            + Lançar mais um turno
          </Link>
        </div>
      )}
      <TotalPill label="Total a pagar aos motos" value={brl(total)} />
    </div>
  );
}

function StepExtras({
  extras,
  pagos,
  pendentes,
}: {
  extras: Extra[];
  pagos: number;
  pendentes: number;
}) {
  return (
    <div className="reveal d2">
      <p className="mb-3 px-1 text-[13px] leading-snug text-muted">
        Freelancers que trabalharam hoje. Quem você já pagou?
      </p>
      {extras.length === 0 ? (
        <EmptyStep
          msg="Nenhum extra hoje."
          ctaHref="/extras/novo"
          ctaLabel="+ Adicionar extra"
        />
      ) : (
        <div className="rounded-card bg-white p-4 shadow-card">
          <div className="divide-y divide-line">
            {extras.map((e) => {
              const centro = e.employees?.centro_custo;
              return (
                <div key={e.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <strong className="block text-sm">{e.employees?.name || "—"}</strong>
                    <small className="text-[11px] text-muted">
                      {centro === "cozinha" ? "Cozinha" : centro === "atendimento" ? "Atendimento" : ""}
                    </small>
                  </div>
                  <div className="font-display text-sm font-bold tabular-nums">
                    {brl(Number(e.amount))}
                  </div>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                      e.paid ? "bg-ok-bg text-ok" : "bg-line text-muted"
                    }`}
                  >
                    {e.paid ? "pago ✓" : "pendente"}
                  </span>
                </div>
              );
            })}
          </div>
          <Link
            href="/extras"
            className="mt-3 block rounded-xl border-[1.5px] border-dashed border-[#C6D3E0] py-2.5 text-center text-xs font-bold text-cyan"
          >
            Marcar pagamentos →
          </Link>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <SummaryMini label="PAGO" value={brl(pagos)} tone="ok" />
        <SummaryMini label="PENDENTE" value={brl(pendentes)} tone="warn" />
      </div>
    </div>
  );
}

function StepDinheiro({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return (
      <div className="reveal d2">
        <p className="mb-3 px-1 text-[13px] leading-snug text-muted">
          Nenhum caixa foi aberto hoje. Abre antes de fechar.
        </p>
        <EmptyStep msg="Sem sessão hoje." ctaHref="/caixa" ctaLabel="Ir pro Caixa" />
      </div>
    );
  }

  return (
    <div className="reveal d2 space-y-3">
      <p className="px-1 text-[13px] leading-snug text-muted">
        Confere a gaveta caixa por caixa. O app compara com o esperado e mostra a diferença.
      </p>
      {sessions.map((s) => {
        const drawerName = s.cash_drawers?.name || "—";
        const label = DRAWER_LABEL[drawerName] || drawerName;
        const closed = s.status === "closed";
        const diff =
          closed && s.expected_amount != null && s.closing_amount != null
            ? Number(s.closing_amount) - Number(s.expected_amount)
            : null;
        return (
          <article key={s.id} className="rounded-card bg-white p-4 shadow-card">
            <div className="mb-1 flex items-center justify-between">
              <strong className="text-sm">{label}</strong>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  closed ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"
                }`}
              >
                {closed ? "fechado" : "aberto"}
              </span>
            </div>
            <div className="text-[12px] text-muted">
              Abertura{" "}
              <span className="font-bold text-navy tabular-nums">
                {brl(Number(s.opening_amount))}
              </span>
              {closed && (
                <>
                  {" "}· Fechamento{" "}
                  <span className="font-bold text-navy tabular-nums">
                    {brl(Number(s.closing_amount))}
                  </span>
                </>
              )}
            </div>
            {diff != null && (
              <div
                className={`mt-2 rounded-xl p-2.5 text-center ${
                  Math.abs(diff) < 0.005
                    ? "bg-ok-bg"
                    : diff < 0
                      ? "bg-danger-bg"
                      : "bg-warn-bg"
                }`}
              >
                <div
                  className={`font-display text-lg font-extrabold ${
                    Math.abs(diff) < 0.005
                      ? "text-ok"
                      : diff < 0
                        ? "text-danger"
                        : "text-warn"
                  }`}
                >
                  {Math.abs(diff) < 0.005
                    ? "Bateu ✓"
                    : `${diff > 0 ? "+" : ""}${brl(diff)}`}
                </div>
              </div>
            )}
            {!closed && (
              <Link
                href={`/caixa/fechar/${s.id}`}
                className="mt-3 block rounded-xl bg-navy py-2.5 text-center text-sm font-bold text-white"
              >
                Contar e fechar {label}
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}

function StepCartoes({ reports, cardTotal }: { reports: Report[]; cardTotal: number }) {
  return (
    <div className="reveal d2">
      <p className="mb-3 px-1 text-[13px] leading-snug text-muted">
        Tira foto do resumo de cada maquininha. A IA lê os valores.
      </p>
      {reports.length === 0 ? (
        <EmptyStep
          msg="Nenhum cupom fotografado hoje."
          ctaHref="/foto"
          ctaLabel="📷 Tirar primeira foto"
        />
      ) : (
        <div className="rounded-card bg-white p-4 shadow-card">
          <div className="divide-y divide-line">
            {reports.map((r, i) => {
              const t = Number(r.credito) + Number(r.debito) + Number(r.pix);
              return (
                <div key={r.id} className="flex items-center gap-3 py-3">
                  <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-[#EEF4F9] text-cyan">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <strong className="block text-sm">Cupom #{i + 1}</strong>
                    <small className="text-[11px] text-muted">
                      {new Date(r.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </div>
                  <div className="font-display text-sm font-bold tabular-nums">
                    {brl(t)}
                  </div>
                </div>
              );
            })}
          </div>
          <Link
            href="/foto"
            className="mt-3 block rounded-xl border-[1.5px] border-dashed border-[#C6D3E0] py-2.5 text-center text-xs font-bold text-cyan"
          >
            📷 Tirar mais uma foto
          </Link>
        </div>
      )}
      <TotalPill label="Total em cartões" value={brl(cardTotal)} />
    </div>
  );
}

function StepConferir({
  motoTotal,
  extrasPagos,
  extrasPendentes,
  cashTotal,
  cashDiff,
  cardTotal,
  cashClosedCount,
}: {
  motoTotal: number;
  extrasPagos: number;
  extrasPendentes: number;
  cashTotal: number;
  cashDiff: number;
  cardTotal: number;
  cashClosedCount: number;
}) {
  const faturamento = cashTotal + cardTotal;
  const cashOk = Math.abs(cashDiff) < 0.005;
  return (
    <div className="reveal d2">
      <p className="mb-3 px-1 text-[13px] leading-snug text-muted">
        Resumo do dia. Se algo não bateu, dá pra voltar e ajustar.
      </p>
      <div className="rounded-card bg-white p-4 shadow-card">
        <SumLine label="🛵 Motoboys" value={brl(motoTotal)} />
        <SumLine
          label="👤 Extras"
          value={brl(extrasPagos)}
          subValue={extrasPendentes > 0 ? `+ ${brl(extrasPendentes)} pendentes` : undefined}
        />
        <SumLine
          label="💵 Dinheiro (gaveta)"
          value={brl(cashTotal)}
          subValue={cashClosedCount === 0 ? "nenhum caixa fechado" : undefined}
        />
        <SumLine label="💳 Cartões" value={brl(cardTotal)} />
        <div className="mt-1 flex items-center justify-between pt-3">
          <span className="text-base font-bold">Faturamento do dia</span>
          <span className="font-display text-[22px] font-extrabold text-cyan tabular-nums">
            {brl(faturamento)}
          </span>
        </div>
      </div>

      {cashClosedCount > 0 && (
        <div
          className={`mt-3 rounded-card p-4 text-center ${
            cashOk ? "bg-ok-bg" : "bg-danger-bg"
          }`}
        >
          <div className={`text-xs font-bold ${cashOk ? "text-ok" : "text-danger"}`}>
            {cashOk ? "Caixa bateu ✓" : "Atenção: diferença no caixa"}
          </div>
          <div
            className={`mt-1 font-display text-lg font-extrabold ${
              cashOk ? "text-ok" : "text-danger"
            }`}
          >
            {cashOk
              ? "Sem diferença"
              : `${cashDiff > 0 ? "+" : ""}${brl(cashDiff)}`}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyStep({
  msg,
  ctaHref,
  ctaLabel,
}: {
  msg: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="rounded-card bg-white p-6 text-center shadow-card">
      <p className="text-sm text-muted">{msg}</p>
      <Link
        href={ctaHref}
        className="mt-3 inline-block rounded-xl bg-cyan px-4 py-2.5 text-sm font-bold text-white"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

function TotalPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-center justify-between rounded-xl bg-navy px-4 py-3 text-white">
      <span className="text-[13px] opacity-80">{label}</span>
      <span className="font-display text-[20px] font-extrabold tabular-nums">{value}</span>
    </div>
  );
}

function SumLine({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="flex items-start justify-between border-b border-line py-3 last:border-b-0">
      <span className="text-sm">{label}</span>
      <div className="text-right">
        <span className="block text-sm font-bold tabular-nums">{value}</span>
        {subValue && <span className="block text-[11px] text-muted">{subValue}</span>}
      </div>
    </div>
  );
}

function SummaryMini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn";
}) {
  return (
    <div className="rounded-card bg-white p-3 shadow-card">
      <div
        className={`text-[11px] font-bold tracking-wider ${
          tone === "ok" ? "text-ok" : "text-warn"
        }`}
      >
        {label}
      </div>
      <div className="mt-0.5 font-display text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
