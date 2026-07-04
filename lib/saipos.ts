import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SaiposSnapshot = {
  id: string;
  captured_at: string;
  work_date: string;
  drawer_name: string | null;
  total_sales: number | null;
  cash_sales: number | null;
  card_sales: number | null;
  pix_sales: number | null;
};

export type SaiposSuggestion = {
  captured_at: string; // captura mais antiga entre as lojas somadas
  total_sales: number;
  cash_sales: number;
  card_sales: number;
  pix_sales: number;
  stores: string[]; // drawer_name (id da loja Saipos) de cada snapshot somado
};

/**
 * Sugestão de vendas do dia: soma o snapshot mais recente de CADA loja Saipos
 * (um snapshot por loja por captura; drawer_name = id da loja, ex: "49895").
 */
export const getSaiposSuggestion = cache(
  async (): Promise<SaiposSuggestion | null> => {
    const supabase = createClient();
    const { data } = await supabase
      .from("saipos_snapshots")
      .select("id, captured_at, work_date, drawer_name, total_sales, cash_sales, card_sales, pix_sales")
      .eq("work_date", todayISO())
      .order("captured_at", { ascending: false });

    const rows = (data as SaiposSnapshot[] | null) ?? [];
    if (rows.length === 0) return null;

    // mais recente por loja (rows já vêm em ordem decrescente de captured_at)
    const latestByStore = new Map<string, SaiposSnapshot>();
    for (const r of rows) {
      const key = r.drawer_name ?? "consolidado";
      if (!latestByStore.has(key)) latestByStore.set(key, r);
    }

    const picked = Array.from(latestByStore.values());
    const sum = (f: (s: SaiposSnapshot) => number | null) =>
      picked.reduce((acc, s) => acc + (Number(f(s)) || 0), 0);

    return {
      captured_at: picked.reduce(
        (min, s) => (s.captured_at < min ? s.captured_at : min),
        picked[0].captured_at,
      ),
      total_sales: sum((s) => s.total_sales),
      cash_sales: sum((s) => s.cash_sales),
      card_sales: sum((s) => s.card_sales),
      pix_sales: sum((s) => s.pix_sales),
      stores: picked.map((s) => s.drawer_name ?? "consolidado"),
    };
  },
);

function todayISO(): string {
  // Dia de trabalho no fuso do restaurante — o server (Vercel) roda em UTC,
  // e depois das 21h BRT já é "amanhã" em UTC.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
