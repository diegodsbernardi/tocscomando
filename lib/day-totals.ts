import { createClient } from "@/lib/supabase/server";
import { MIN_DAILY_PAYMENT } from "@/lib/motoboys";
import { todayISO, startOfDayISO } from "@/lib/dates";

export type DayTotals = {
  moto_total: number;
  extras_pagos: number;
  extras_pendentes: number;
  cash_total: number;
  cash_diff: number;
  card_total: number;
};

export type DayShift = {
  id: string;
  motoboy_id: string;
  motoboys: { name: string } | null;
  motoboy_shift_rides: { rides_count: number; fee_at_time: number }[];
};

export type DayExtra = {
  id: string;
  amount: number;
  paid: boolean;
  employees: { name: string; centro_custo: "atendimento" | "cozinha" } | null;
};

export type DaySession = {
  id: string;
  drawer_id: string;
  opening_amount: number;
  closing_amount: number | null;
  expected_amount: number | null;
  status: "open" | "closed";
  cash_drawers: { name: string } | null;
};

export type DayReport = {
  id: string;
  credito: number;
  debito: number;
  pix: number;
  total: number;
  created_at: string;
};

export type DayData = {
  shifts: DayShift[];
  extras: DayExtra[];
  sessions: DaySession[];
  reports: DayReport[];
  totals: DayTotals;
};

/**
 * Dados e totais do dia (fuso SP). Fonte única usada pela tela "Fechar o dia"
 * e pela action closeDay — a action SEMPRE usa escopo global (scopedDrawerId
 * null) pra não gravar totais parciais de operador escopado.
 */
export async function getDayData(scopedDrawerId: string | null = null): Promise<DayData> {
  const supabase = createClient();
  const today = todayISO();

  let sessionsQuery = supabase
    .from("cash_sessions")
    .select("id, drawer_id, opening_amount, closing_amount, expected_amount, status, cash_drawers(name)")
    .eq("work_date", today);
  if (scopedDrawerId) sessionsQuery = sessionsQuery.eq("drawer_id", scopedDrawerId);

  const [{ data: shiftsRaw }, { data: extrasRaw }, { data: sessionsRaw }, { data: reportsRaw }] =
    await Promise.all([
      supabase
        .from("motoboy_shifts")
        .select("id, motoboy_id, motoboys(name), motoboy_shift_rides(rides_count, fee_at_time)")
        .eq("work_date", today),
      supabase
        .from("extra_payments")
        .select("id, amount, paid, employees(name, centro_custo)")
        .eq("work_date", today),
      sessionsQuery,
      // cupons do dia da equipe toda (RLS reports_select_team)
      supabase
        .from("reports")
        .select("id, credito, debito, pix, total, created_at")
        .gte("created_at", startOfDayISO()),
    ]);

  const shifts = (shiftsRaw || []) as unknown as DayShift[];
  const extras = (extrasRaw || []) as unknown as DayExtra[];
  const sessions = (sessionsRaw || []) as unknown as DaySession[];
  const reports = (reportsRaw || []) as DayReport[];

  const moto_total = shifts.reduce((acc, s) => {
    const raw = s.motoboy_shift_rides.reduce(
      (a, r) => a + Number(r.rides_count) * Number(r.fee_at_time),
      0,
    );
    return acc + Math.max(raw, MIN_DAILY_PAYMENT);
  }, 0);

  const extras_pagos = extras.filter((e) => e.paid).reduce((a, e) => a + Number(e.amount), 0);
  const extras_pendentes = extras.filter((e) => !e.paid).reduce((a, e) => a + Number(e.amount), 0);

  const cashClosed = sessions.filter((s) => s.status === "closed");
  const cash_total = cashClosed.reduce((a, s) => a + Number(s.closing_amount ?? 0), 0);
  const cash_diff = cashClosed.reduce(
    (a, s) =>
      s.expected_amount != null && s.closing_amount != null
        ? a + (Number(s.closing_amount) - Number(s.expected_amount))
        : a,
    0,
  );

  const card_total = reports.reduce(
    (a, r) => a + Number(r.credito) + Number(r.debito) + Number(r.pix),
    0,
  );

  return {
    shifts,
    extras,
    sessions,
    reports,
    totals: { moto_total, extras_pagos, extras_pendentes, cash_total, cash_diff, card_total },
  };
}
