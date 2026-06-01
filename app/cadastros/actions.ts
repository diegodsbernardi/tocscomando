"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateUserProfile(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  // Confere que o caller é admin
  const { data: me } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (!me || me.role !== "admin") {
    return { ok: false, error: "Só admin pode mudar papéis." };
  }

  const target_user_id = String(formData.get("user_id") || "");
  const display_name = String(formData.get("display_name") || "").trim() || null;
  const role = String(formData.get("role") || "");
  const drawerRaw = String(formData.get("default_drawer_id") || "");
  const default_drawer_id = drawerRaw && drawerRaw !== "none" ? drawerRaw : null;

  if (!target_user_id) return { ok: false, error: "Usuário inválido." };
  if (role !== "admin" && role !== "operator") {
    return { ok: false, error: "Papel inválido." };
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({
      display_name,
      role,
      default_drawer_id,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", target_user_id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cadastros");
  revalidatePath("/");
  revalidatePath("/caixa");
  revalidatePath("/fechar-o-dia");
  return { ok: true };
}
