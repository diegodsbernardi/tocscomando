"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";

function friendly(msg: string) {
  if (msg.includes("shift_notes")) {
    return "Mural de recados ainda não criado no banco (rodar migration).";
  }
  return msg;
}

export async function addNote(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const content = String(formData.get("content") || "").trim();
  if (content.length < 2) return { ok: false, error: "Escreve o recado primeiro 😉" };
  if (content.length > 500) return { ok: false, error: "Recado muito longo (máx. 500)" };

  const profile = await getCurrentProfile();
  const { error } = await supabase.from("shift_notes").insert({
    author_id: user.id,
    author_name: profile?.display_name ?? null,
    content,
  });

  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/");
  return { ok: true };
}

export async function resolveNote(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const profile = await getCurrentProfile();
  const { error } = await supabase
    .from("shift_notes")
    .update({
      resolved: true,
      resolved_by: user.id,
      resolved_by_name: profile?.display_name ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/");
  return { ok: true };
}
