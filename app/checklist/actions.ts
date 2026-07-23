"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { todayISO } from "@/lib/dates";
import { CHECKLIST_ABERTURA, CHECKLIST_FECHAMENTO } from "@/lib/checklist";

const VALID_KEYS = new Set(
  [...CHECKLIST_ABERTURA, ...CHECKLIST_FECHAMENTO].map((i) => i.key),
);

function friendly(msg: string) {
  if (msg.includes("day_checklist")) {
    return "Checklist ainda não criado no banco (rodar migration).";
  }
  return msg;
}

export async function toggleCheck(itemKey: string, done: boolean) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };
  if (!VALID_KEYS.has(itemKey)) return { ok: false, error: "Item inválido" };

  if (done) {
    const profile = await getCurrentProfile();
    const { error } = await supabase.from("day_checklist").upsert(
      {
        work_date: todayISO(),
        item_key: itemKey,
        done_by: user.id,
        done_by_name: profile?.display_name ?? null,
        done_at: new Date().toISOString(),
      },
      { onConflict: "work_date,item_key" },
    );
    if (error) return { ok: false, error: friendly(error.message) };
  } else {
    const { error } = await supabase
      .from("day_checklist")
      .delete()
      .eq("work_date", todayISO())
      .eq("item_key", itemKey);
    if (error) return { ok: false, error: friendly(error.message) };
  }

  revalidatePath("/checklist");
  revalidatePath("/");
  return { ok: true };
}
