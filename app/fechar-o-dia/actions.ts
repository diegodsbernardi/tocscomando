"use server";

import { revalidatePath } from "next/cache";
import { todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { getDayData } from "@/lib/day-totals";

/**
 * Grava (ou atualiza) o fechamento do dia em day_closures.
 * Os totais são SEMPRE recalculados aqui, no escopo global (todos os caixas) —
 * o client não manda números, só o clique.
 */
export async function closeDay() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const profile = await getCurrentProfile();
  const { totals } = await getDayData(null);

  const { error } = await supabase.from("day_closures").upsert(
    {
      work_date: todayISO(),
      closed_by: user.id,
      closed_by_name: profile?.display_name ?? null,
      ...totals,
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
