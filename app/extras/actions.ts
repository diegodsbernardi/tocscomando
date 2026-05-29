"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function markPaid(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase
    .from("extra_payments")
    .update({
      paid: true,
      paid_at: new Date().toISOString(),
      paid_by: user.id,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/extras");
  revalidatePath("/");
  return { ok: true };
}

export async function markUnpaid(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase
    .from("extra_payments")
    .update({ paid: false, paid_at: null, paid_by: null, paid_amount: null })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/extras");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteExtra(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase.from("extra_payments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/extras");
  revalidatePath("/");
  return { ok: true };
}

export async function createExtra(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const employee_id = String(formData.get("employee_id") || "");
  const work_date = String(formData.get("work_date") || "");
  const amount = Number(formData.get("amount") || 0);
  const paid = formData.get("paid") === "on";
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!employee_id || !work_date || !(amount > 0)) {
    return { ok: false, error: "Preencha funcionário, data e valor." };
  }

  const { error } = await supabase.from("extra_payments").insert({
    employee_id,
    work_date,
    amount,
    paid,
    paid_at: paid ? new Date().toISOString() : null,
    paid_by: paid ? user.id : null,
    notes,
    created_by: user.id,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/extras");
  revalidatePath("/");
  redirect("/extras");
}
