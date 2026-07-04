"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";

function friendly(error: { message: string }) {
  if (error.message.includes("suggestions")) {
    return "Caixa de sugestões ainda não criada no banco (rodar migration).";
  }
  return error.message;
}

export async function addSuggestion(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const content = String(formData.get("content") || "").trim();
  if (content.length < 3) return { ok: false, error: "Escreve a sugestão primeiro 😉" };
  if (content.length > 1000) return { ok: false, error: "Sugestão muito longa (máx. 1000 caracteres)" };

  const profile = await getCurrentProfile();

  const { error } = await supabase.from("suggestions").insert({
    author_id: user.id,
    author_name: profile?.display_name ?? null,
    content,
  });

  if (error) return { ok: false, error: friendly(error) };
  revalidatePath("/sugestoes");
  return { ok: true };
}

export async function toggleSuggestionStatus(id: string, implemented: boolean) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase
    .from("suggestions")
    .update({ status: implemented ? "implementada" : "nova" })
    .eq("id", id);

  if (error) return { ok: false, error: friendly(error) };
  revalidatePath("/sugestoes");
  return { ok: true };
}

export async function deleteSuggestion(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase.from("suggestions").delete().eq("id", id);
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath("/sugestoes");
  return { ok: true };
}
