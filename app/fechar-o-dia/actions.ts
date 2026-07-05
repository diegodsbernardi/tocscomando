"use server";

import { revalidatePath } from "next/cache";
import { todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";

export type DayTotals = {
  moto_total: number;
  extras_pagos: number;
  extras_pendentes: number;
  cash_total: number;
  cash_diff: number;
  card_total: number;
};



/**
 * Grava (ou atualiza) o fechamento do dia em day_closures.
 * Refechar o mesmo dia sobrescreve os totais (upsert por work_date).
 */
export async function closeDay(totals: DayTotals) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const profile = await getCurrentProfile();

  const { error } = await supabase.from("day_closures").upsert(
    {
      work_date: todayISO(),
      closed_by: user.id,
      closed_by_name: profile?.display_name ?? null,
      moto_total: totals.moto_total,
      extras_pagos: totals.extras_pagos,
      extras_pendentes: totals.extras_pendentes,
      cash_total: totals.cash_total,
      cash_diff: totals.cash_diff,
      card_total: totals.card_total,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "work_date" },
  );

  if (error) {
    if (error.message.includes("day_closures")) {
      return { ok: false, error: "Tabela de fechamentos ainda não criada no banco (rodar migration)." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/");
  revalidatePath("/fechar-o-dia");
  return { ok: true };
}
