"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function deleteReport(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Não autenticado" };
  }

  // Pega o image_path antes de deletar a linha
  const { data: report, error: fetchErr } = await supabase
    .from("reports")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !report) {
    return { ok: false, error: "Relatório não encontrado" };
  }

  // Apaga o arquivo do storage (se houver)
  if (report.image_path) {
    await supabase.storage.from("reports").remove([report.image_path]);
  }

  // Apaga a linha
  const { error: delErr } = await supabase
    .from("reports")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (delErr) {
    return { ok: false, error: delErr.message };
  }

  revalidatePath("/historico");
  revalidatePath("/");
  return { ok: true };
}
