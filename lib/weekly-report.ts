import { createClient } from "@/lib/supabase/server";
import { MIN_DAILY_PAYMENT } from "@/lib/motoboys";
import { todayISO } from "@/lib/dates";
import { startOfTuesdayWeek, endOfTuesdayWeek } from "@/lib/week";
import { brl } from "@/lib/format";

/**
 * Relatório semanal (semana operacional ter→seg) pronto pro WhatsApp.
 *
 * Fontes:
 * - Faturamento por dia: saipos_snapshots (último snapshot por loja por dia, somado).
 * - Motoboys: motoboy_shifts + rides, com piso diário (MIN_DAILY_PAYMENT) por turno.
 * - Extras: extra_payments (pagos × pendentes).
 * - Quebra de caixa: cash_sessions fechadas (closing − expected).
 * - Dias sem fechamento: dia com movimento (sessão ou turno) sem day_closures.
 */

export type ReportDay = {
  date: string; // YYYY-MM-DD
  label: string; // "ter 30/jun"
  faturamento: number | null; // null = sem snapshot no dia
};

export type WeeklyReport = {
  weekStart: string;
  weekEnd: string;
  isCurrentWeek: boolean; // semana em andamento (parcial)
  days: ReportDay[];
  faturamentoTotal: number;
  diasComVenda: number;
  motoTotal: number;
  extrasPagos: number;
  extrasPendentes: number;
  quebraCaixa: number; // soma (closing − expected); negativo = falta
  diasSemFechamento: string[]; // labels dos dias com movimento sem day_closures
  error: string | null;
};

/** Soma delta dias a uma data YYYY-MM-DD sem depender do TZ do server. */
export function shiftDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** "ter 30/jun" a partir de YYYY-MM-DD (fixo em SP). */
export function dayLabel(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  })
    .format(new Date(`${iso}T12:00:00-03:00`))
    .replace(/\./g, "")
    .replace(" de ", "/");
}

/** Início (terça) da semana operacional anterior à corrente. */
export function previousWeekStart(): string {
  return shiftDays(startOfTuesdayWeek(todayISO()), -7);
}

/** Normaliza um ?semana= qualquer pro início (terça) da semana dele. */
export function normalizeWeekParam(param: string | undefined): string {
  const iso = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : null;
  if (!iso) return previousWeekStart();
  const start = startOfTuesdayWeek(iso);
  // não deixa passar da semana corrente
  const currentStart = startOfTuesdayWeek(todayISO());
  return start > currentStart ? currentStart : start;
}

export async function getWeeklyReport(weekStart: string): Promise<WeeklyReport> {
  const supabase = createClient();
  const start = startOfTuesdayWeek(weekStart);
  const end = endOfTuesdayWeek(start);
  const today = todayISO();
  const isCurrentWeek = start === startOfTuesdayWeek(today);

  const [snapshots, shifts, extras, sessions, closures] = await Promise.all([
    supabase
      .from("saipos_snapshots")
      .select("work_date, drawer_name, total_sales, captured_at")
      .gte("work_date", start)
      .lte("work_date", end)
      .order("captured_at", { ascending: false }),
    supabase
      .from("motoboy_shifts")
      .select("id, work_date, motoboy_shift_rides(rides_count, fee_at_time)")
      .gte("work_date", start)
      .lte("work_date", end),
    supabase
      .from("extra_payments")
      .select("amount, paid, work_date")
      .gte("work_date", start)
      .lte("work_date", end),
    supabase
      .from("cash_sessions")
      .select("work_date, status, closing_amount, expected_amount")
      .gte("work_date", start)
      .lte("work_date", end),
    supabase
      .from("day_closures")
      .select("work_date")
      .gte("work_date", start)
      .lte("work_date", end),
  ]);

  const error =
    snapshots.error?.message ??
    shifts.error?.message ??
    extras.error?.message ??
    sessions.error?.message ??
    closures.error?.message ??
    null;

  // Faturamento por dia: último snapshot por loja por dia, somado
  const latestByStoreDay = new Map<string, number>();
  for (const r of snapshots.data ?? []) {
    const key = `${r.work_date}|${r.drawer_name ?? "consolidado"}`;
    if (!latestByStoreDay.has(key)) {
      latestByStoreDay.set(key, Number(r.total_sales) || 0);
    }
  }
  const dayTotal = new Map<string, number>();
  latestByStoreDay.forEach((v, key) => {
    const date = key.split("|")[0];
    dayTotal.set(date, (dayTotal.get(date) ?? 0) + v);
  });

  const days: ReportDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDays(start, i);
    return {
      date,
      label: dayLabel(date),
      faturamento: dayTotal.has(date) ? dayTotal.get(date)! : null,
    };
  });

  const faturamentoTotal = days.reduce((a, d) => a + (d.faturamento ?? 0), 0);
  const diasComVenda = days.filter((d) => d.faturamento != null).length;

  // Motoboys: piso por turno (mesma fórmula de lib/day-totals.ts)
  type ShiftRow = {
    work_date: string;
    motoboy_shift_rides: { rides_count: number; fee_at_time: number }[];
  };
  const motoTotal = ((shifts.data ?? []) as unknown as ShiftRow[]).reduce((acc, s) => {
    const raw = s.motoboy_shift_rides.reduce(
      (a, r) => a + Number(r.rides_count) * Number(r.fee_at_time),
      0,
    );
    return acc + Math.max(raw, MIN_DAILY_PAYMENT);
  }, 0);

  const extrasPagos = (extras.data ?? [])
    .filter((e) => e.paid)
    .reduce((a, e) => a + Number(e.amount), 0);
  const extrasPendentes = (extras.data ?? [])
    .filter((e) => !e.paid)
    .reduce((a, e) => a + Number(e.amount), 0);

  const quebraCaixa = (sessions.data ?? []).reduce(
    (a, s) =>
      s.status === "closed" && s.closing_amount != null && s.expected_amount != null
        ? a + (Number(s.closing_amount) - Number(s.expected_amount))
        : a,
    0,
  );

  // Dias com movimento sem fechamento (só dias já passados)
  const closedDays = new Set((closures.data ?? []).map((c) => c.work_date as string));
  const movementDays = new Set<string>();
  (sessions.data ?? []).forEach((s) => movementDays.add(s.work_date as string));
  ((shifts.data ?? []) as unknown as ShiftRow[]).forEach((s) => movementDays.add(s.work_date));
  const diasSemFechamento = days
    .filter((d) => d.date < today && movementDays.has(d.date) && !closedDays.has(d.date))
    .map((d) => d.label);

  return {
    weekStart: start,
    weekEnd: end,
    isCurrentWeek,
    days,
    faturamentoTotal,
    diasComVenda,
    motoTotal,
    extrasPagos,
    extrasPendentes,
    quebraCaixa,
    diasSemFechamento,
    error,
  };
}

/** Versão texto do relatório com negrito do WhatsApp (*...*). */
export function buildWhatsAppText(r: WeeklyReport): string {
  const range = `${dayLabel(r.weekStart)} a ${dayLabel(r.weekEnd)}`;
  const lines: string[] = [];
  lines.push(`*TOCS Burger — semana ${range}*${r.isCurrentWeek ? " (em andamento)" : ""}`);
  lines.push("");
  lines.push(`💰 Faturamento: *${brl(r.faturamentoTotal)}*`);
  for (const d of r.days) {
    lines.push(`• ${d.label}: ${d.faturamento != null ? brl(d.faturamento) : "—"}`);
  }
  lines.push("");
  lines.push(`🛵 Motoboys: ${brl(r.motoTotal)}`);
  lines.push(
    `👷 Extras: ${brl(r.extrasPagos)} pagos` +
      (r.extrasPendentes > 0 ? ` · ${brl(r.extrasPendentes)} pendentes` : ""),
  );
  lines.push(
    `💵 Quebra de caixa: ${r.quebraCaixa < 0 ? "−" : ""}${brl(Math.abs(r.quebraCaixa))}`,
  );
  if (r.diasSemFechamento.length > 0) {
    lines.push(
      `⚠️ ${r.diasSemFechamento.length} ${r.diasSemFechamento.length === 1 ? "dia" : "dias"} sem fechamento: ${r.diasSemFechamento.join(", ")}`,
    );
  }
  const sobra = r.faturamentoTotal - r.motoTotal - r.extrasPagos - r.extrasPendentes;
  lines.push("");
  lines.push(`📊 Sobra após motos+extras: *${brl(sobra)}*`);
  return lines.join("\n");
}
