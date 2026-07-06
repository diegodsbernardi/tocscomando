import { cache } from "react";
import { todayISO } from "./dates";
import { createClient } from "@/lib/supabase/server";

/**
 * Alerta de quebra de caixa recorrente.
 *
 * Olha as sessões fechadas dos últimos LOOKBACK_DAYS dias e, por caixa,
 * calcula quebra acumulada e quantos dias tiveram quebra além da tolerância.
 */

/** Janela de análise, em dias (inclui hoje). */
export const LOOKBACK_DAYS = 14;
/** Diferença negativa (em R$) a partir da qual o dia conta como "dia com quebra". */
export const QUEBRA_TOLERANCIA = 5;
/** Nº de dias com quebra na janela a partir do qual vira "recorrente" (warn). */
export const DIAS_RECORRENTE = 3;
/** Quebra acumulada (negativa) a partir da qual vira "grave" (danger). */
export const QUEBRA_GRAVE = -100;

export type DrawerAlert = {
  drawerId: string;
  drawerName: string;
  /** Soma das diferenças (closing - expected) das sessões da janela. Negativo = falta. */
  acumulado: number;
  /** Nº de dias distintos com quebra além de QUEBRA_TOLERANCIA. */
  diasComQuebra: number;
  recorrente: boolean;
  grave: boolean;
};

export type CashAlerts = {
  lookbackDays: number;
  startDate: string;
  endDate: string;
  drawers: DrawerAlert[];
  /** true se alguma caixa está recorrente ou grave. */
  hasAlert: boolean;
};

function shiftDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dd = new Date(y, m - 1, d);
  dd.setDate(dd.getDate() + delta);
  return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`;
}

export const getCashAlerts = cache(async (): Promise<CashAlerts> => {
  const supabase = createClient();
  const endDate = todayISO();
  const startDate = shiftDays(endDate, -(LOOKBACK_DAYS - 1));

  const { data, error } = await supabase
    .from("cash_sessions")
    .select(
      "drawer_id, work_date, closing_amount, expected_amount, cash_drawers(name)",
    )
    .eq("status", "closed")
    .gte("work_date", startDate)
    .lte("work_date", endDate);

  if (error) {
    return { lookbackDays: LOOKBACK_DAYS, startDate, endDate, drawers: [], hasAlert: false };
  }

  type Row = {
    drawer_id: string;
    work_date: string;
    closing_amount: number | string | null;
    expected_amount: number | string | null;
    cash_drawers: { name: string } | { name: string }[] | null;
  };

  const byDrawer = new Map<
    string,
    { name: string; acumulado: number; diasComQuebra: Set<string> }
  >();

  for (const row of (data || []) as Row[]) {
    if (row.closing_amount == null || row.expected_amount == null) continue;
    const diff = Number(row.closing_amount) - Number(row.expected_amount);
    const dObj = Array.isArray(row.cash_drawers)
      ? row.cash_drawers[0]
      : row.cash_drawers;
    const name = dObj?.name ?? "Caixa";
    let agg = byDrawer.get(row.drawer_id);
    if (!agg) {
      agg = { name, acumulado: 0, diasComQuebra: new Set() };
      byDrawer.set(row.drawer_id, agg);
    }
    agg.acumulado += diff;
    if (diff < -QUEBRA_TOLERANCIA) agg.diasComQuebra.add(row.work_date);
  }

  const drawers: DrawerAlert[] = Array.from(byDrawer.entries())
    .map(([drawerId, a]) => ({
      drawerId,
      drawerName: a.name,
      acumulado: a.acumulado,
      diasComQuebra: a.diasComQuebra.size,
      recorrente: a.diasComQuebra.size >= DIAS_RECORRENTE,
      grave: a.acumulado <= QUEBRA_GRAVE,
    }))
    .sort((x, y) => x.acumulado - y.acumulado);

  return {
    lookbackDays: LOOKBACK_DAYS,
    startDate,
    endDate,
    drawers,
    hasAlert: drawers.some((d) => d.recorrente || d.grave),
  };
});
