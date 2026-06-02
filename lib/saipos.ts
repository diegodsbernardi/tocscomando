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

/**
 * Pega o snapshot mais recente do dia atual.
 * Pode filtrar por drawer ('DLV' / 'LTDA') ou retornar consolidado (drawer_name null).
 */
export const getLatestSaiposSnapshot = cache(
  async (
    drawerName: string | null = null,
  ): Promise<SaiposSnapshot | null> => {
    const supabase = createClient();
    const today = todayISO();
    let q = supabase
      .from("saipos_snapshots")
      .select("id, captured_at, work_date, drawer_name, total_sales, cash_sales, card_sales, pix_sales")
      .eq("work_date", today)
      .order("captured_at", { ascending: false })
      .limit(1);

    if (drawerName) q = q.eq("drawer_name", drawerName);

    const { data } = await q.maybeSingle();
    return (data as SaiposSnapshot | null) ?? null;
  },
);

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
