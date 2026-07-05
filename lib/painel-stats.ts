import { cache } from "react";
import { todayISO as spToday, toSPDate } from "./dates";
import { createClient } from "@/lib/supabase/server";
import { MIN_DAILY_PAYMENT } from "@/lib/motoboys";
import { startOfTuesdayWeek, endOfTuesdayWeek } from "@/lib/week";

export type DayPoint = { date: string; total: number };

export type PainelData = {
  // semana corrente (ter–seg)
  weekStart: string;
  weekEnd: string;
  weekFaturamento: number;
  weekCupons: number;
  prevWeekFaturamento: number;
  weekDeltaPct: number | null;

  // últimos 14 dias (pra chart de barras)
  last14: DayPoint[];

  // mês corrente
  monthLabel: string;
  monthFaturamento: number;
  monthCustoMotos: number;
  monthCustoExtras: number;
  monthDiferencaCaixa: number; // soma das diferenças (closing - expected)
  monthCustoTotal: number; // motos + extras + abs(dif)

  // mix de pagamento (mês)
  mixCredito: number;
  mixDebito: number;
  mixPix: number;
};

function todayISO(): string {
  return spToday();
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dd = new Date(y, m - 1, d);
  dd.setDate(dd.getDate() + delta);
  return isoDate(dd);
}

function startOfMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

function endOfMonthExclusive(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const next = new Date(y, m, 1);
  return isoDate(next);
}

function monthLabelOf(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m - 1, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export const getPainelData = cache(async (): Promise<PainelData> => {
  const supabase = createClient();
  const today = todayISO();

  const weekStart = startOfTuesdayWeek(today);
  const weekEnd = endOfTuesdayWeek(today);
  const prevWeekStart = shiftDays(weekStart, -7);
  const prevWeekEnd = shiftDays(weekEnd, -7);

  const monthStart = startOfMonth(today);
  const monthEndExc = endOfMonthExclusive(today);

  const last14Start = shiftDays(today, -13);

  // Helpers de janela: created_at é timestamptz, work_date é date.
  const startOfDayISO = (iso: string) => `${iso}T00:00:00`;
  const endOfDayExclusiveISO = (iso: string) =>
    `${shiftDays(iso, 1)}T00:00:00`;

  // Reports (faturamento): consultamos uma única vez no maior intervalo necessário
  // e fatiamos depois.
  const reportsStart = [last14Start, prevWeekStart, monthStart].sort()[0];

  const [
    { data: reportsRaw },
    { data: shiftsRaw },
    { data: extrasRaw },
    { data: sessionsRaw },
  ] = await Promise.all([
    supabase
      .from("reports")
      .select("credito, debito, pix, total, created_at")
      .gte("created_at", startOfDayISO(reportsStart))
      .lt("created_at", endOfDayExclusiveISO(today)),
    supabase
      .from("motoboy_shifts")
      .select("id, work_date, motoboy_shift_rides(rides_count, fee_at_time)")
      .gte("work_date", monthStart)
      .lt("work_date", monthEndExc),
    supabase
      .from("extra_payments")
      .select("amount, paid, work_date")
      .gte("work_date", monthStart)
      .lt("work_date", monthEndExc),
    supabase
      .from("cash_sessions")
      .select("closing_amount, expected_amount, status, work_date")
      .gte("work_date", monthStart)
      .lt("work_date", monthEndExc)
      .eq("status", "closed"),
  ]);

  const reports = (reportsRaw || []) as {
    credito: number | string;
    debito: number | string;
    pix: number | string;
    total: number | string;
    created_at: string;
  }[];

  // Faturamento agregado por dia (YYYY-MM-DD do timezone local do servidor)
  const dayTotal = new Map<string, number>();
  const dayCupons = new Map<string, number>();
  let mixCredito = 0;
  let mixDebito = 0;
  let mixPix = 0;
  let monthFaturamento = 0;

  for (const r of reports) {
    const iso = toSPDate(r.created_at);
    const total = Number(r.total) || 0;
    dayTotal.set(iso, (dayTotal.get(iso) ?? 0) + total);
    dayCupons.set(iso, (dayCupons.get(iso) ?? 0) + 1);

    // Mix e mês: só conta se for do mês corrente
    if (iso >= monthStart && iso < monthEndExc) {
      mixCredito += Number(r.credito) || 0;
      mixDebito += Number(r.debito) || 0;
      mixPix += Number(r.pix) || 0;
      monthFaturamento += total;
    }
  }

  const sumRange = (startIncl: string, endIncl: string) => {
    let sum = 0;
    let cupons = 0;
    let cur = startIncl;
    while (cur <= endIncl) {
      sum += dayTotal.get(cur) ?? 0;
      cupons += dayCupons.get(cur) ?? 0;
      cur = shiftDays(cur, 1);
    }
    return { sum, cupons };
  };

  const week = sumRange(weekStart, weekEnd);
  const prev = sumRange(prevWeekStart, prevWeekEnd);

  // Custos diretos do mês
  const shifts = (shiftsRaw || []) as {
    motoboy_shift_rides: { rides_count: number; fee_at_time: number }[];
  }[];
  const monthCustoMotos = shifts.reduce((acc, s) => {
    const raw = s.motoboy_shift_rides.reduce(
      (a, r) => a + Number(r.rides_count) * Number(r.fee_at_time),
      0,
    );
    return acc + Math.max(raw, MIN_DAILY_PAYMENT);
  }, 0);

  const extras = (extrasRaw || []) as { amount: number; paid: boolean }[];
  const monthCustoExtras = extras.reduce((a, e) => a + Number(e.amount), 0);

  const sessions = (sessionsRaw || []) as {
    closing_amount: number | null;
    expected_amount: number | null;
  }[];
  const monthDiferencaCaixa = sessions.reduce((acc, s) => {
    if (s.closing_amount == null || s.expected_amount == null) return acc;
    return acc + (Number(s.closing_amount) - Number(s.expected_amount));
  }, 0);

  // Chart últimos 14 dias
  const last14: DayPoint[] = [];
  let cur = last14Start;
  while (cur <= today) {
    last14.push({ date: cur, total: dayTotal.get(cur) ?? 0 });
    cur = shiftDays(cur, 1);
  }

  return {
    weekStart,
    weekEnd,
    weekFaturamento: week.sum,
    weekCupons: week.cupons,
    prevWeekFaturamento: prev.sum,
    weekDeltaPct: prev.sum > 0 ? ((week.sum - prev.sum) / prev.sum) * 100 : null,
    last14,
    monthLabel: monthLabelOf(monthStart),
    monthFaturamento,
    monthCustoMotos,
    monthCustoExtras,
    monthDiferencaCaixa,
    monthCustoTotal:
      monthCustoMotos + monthCustoExtras + Math.abs(monthDiferencaCaixa),
    mixCredito,
    mixDebito,
    mixPix,
  };
});
