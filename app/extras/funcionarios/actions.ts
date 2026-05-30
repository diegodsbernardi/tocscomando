"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createEmployee(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const name = String(formData.get("name") || "").trim();
  const centro_custo = String(formData.get("centro_custo") || "");
  const phone = String(formData.get("phone") || "").trim() || null;

  if (!name) return { ok: false, error: "Nome obrigatório." };
  if (centro_custo !== "atendimento" && centro_custo !== "cozinha") {
    return { ok: false, error: "Centro de custo inválido." };
  }

  const { error } = await supabase
    .from("employees")
    .insert({ name, centro_custo, phone });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Já existe um funcionário com esse nome." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/cadastros");
  revalidatePath("/extras/funcionarios");
  revalidatePath("/extras/novo");
  return { ok: true };
}

export async function updateEmployee(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  if (!id || !name) return { ok: false, error: "Dados incompletos." };

  const { error } = await supabase
    .from("employees")
    .update({ name, phone })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cadastros");
  return { ok: true };
}

export async function toggleEmployeeActive(id: string, active: boolean) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase
    .from("employees")
    .update({ active })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cadastros");
  revalidatePath("/extras/funcionarios");
  revalidatePath("/extras/novo");
  return { ok: true };
}
