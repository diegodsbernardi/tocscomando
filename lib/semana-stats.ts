import { cache } from "react";
import { todayISO } from "./dates";
import { createClient } from "@/lib/supabase/server";

/**
 * Comparativo de vendas por dia da semana — média de faturamento (Saipos)
 * por dia da semana nas últimas 8 semanas.
 *
 * Fonte: saipos_snapshots, último snapshot por loja por dia, somado por dia.
 * Dias sem snapshot ficam FORA da média (não contam como zero).
 * O dia de hoje fica fora (snapshot parcial distorceria a média).
 */

export const SEMANAS_LOOKBACK = 8;

export type WeekdayAvg = {
  dow: number; // 0=dom .. 6=sáb
  label: string; // "seg", "ter", ...
  avg: number; // média de faturamento nos dias com snapshot
  days: number; // quantos dias entraram na média
  peak: boolean; // maior média
  low: boolean; // menor média
};

export type SemanaData = {
  weekdays: WeekdayAvg[]; // ordem ter..dom (+ seg no fim, se houver dado)
  totalDays: number; // dias com snapshot no período
  rangeStart: string; // primeiro dia considerado (YYYY-MM-DD)
  rangeEnd: string; // último dia considerado (ontem)
};

const DOW_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Dia da semana (0=dom) de uma data YYYY-MM-DD, sem depender do TZ do server. */
function dayOfWeek(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

function shiftDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export const getSemanaData = cache(async (): Promise<SemanaData> => {
  const supabase = createClient();
  const today = todayISO();
  // Janela: 8 semanas completas terminando ontem (hoje é parcial).
  const rangeEnd = shiftDays(today, -1);
  const rangeStart = shiftDays(rangeEnd, -(SEMANAS_LOOKBACK * 7 - 1));

  const { data } = await supabase
    .from("saipos_snapshots")
    .select("work_date, drawer_name, total_sales, captured_at")
    .gte("work_date", rangeStart)
    .lte("work_date", rangeEnd)
    .order("captured_at", { ascending: false });

  const rows = (data || []) as {
    work_date: string;
    drawer_name: string | null;
    total_sales: number | string | null;
  }[];

  // Último snapshot por loja por dia (rows já em ordem decrescente de captured_at)
  const latestByStoreDay = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.work_date}|${r.drawer_name ?? "consolidado"}`;
    if (!latestByStoreDay.has(key)) {
      latestByStoreDay.set(key, Number(r.total_sales) || 0);
    }
  }

  // Total por dia (soma das lojas)
  const dayTotal = new Map<string, number>();
  latestByStoreDay.forEach((v, key) => {
    const date = key.split("|")[0];
    dayTotal.set(date, (dayTotal.get(date) ?? 0) + v);
  });

  // Agrupa por dia da semana
  const byDow = new Map<number, { sum: number; days: number }>();
  dayTotal.forEach((total, date) => {
    const dow = dayOfWeek(date);
    const cur = byDow.get(dow) ?? { sum: 0, days: 0 };
    cur.sum += total;
    cur.days += 1;
    byDow.set(dow, cur);
  });

  // Ordem ter..dom (seg costuma ser folga; só entra se tiver dado)
  const order = [2, 3, 4, 5, 6, 0];
  if (byDow.has(1)) order.push(1);

  const weekdays: WeekdayAvg[] = order
    .filter((dow) => byDow.has(dow))
    .map((dow) => {
      const { sum, days } = byDow.get(dow)!;
      return {
        dow,
        label: DOW_LABELS[dow],
        avg: sum / days,
        days,
        peak: false,
        low: false,
      };
    });

  if (weekdays.length > 1) {
    let maxI = 0;
    let minI = 0;
    weekdays.forEach((w, i) => {
      if (w.avg > weekdays[maxI].avg) maxI = i;
      if (w.avg < weekdays[minI].avg) minI = i;
    });
    weekdays[maxI].peak = true;
    weekdays[minI].low = true;
  }

  return { weekdays, totalDays: dayTotal.size, rangeStart, rangeEnd };
});
