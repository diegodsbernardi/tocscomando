"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseBreakdown(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export async function openSession(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const drawer_id = String(formData.get("drawer_id") || "");
  const opening_amount = Number(formData.get("opening_amount") || 0);
  const opening_breakdown = parseBreakdown(formData.get("opening_breakdown"));
  const notes = String(formData.get("notes") || "").trim() || null;
  const expected_amount_raw = formData.get("expected_amount");
  const expected_amount =
    typeof expected_amount_raw === "string" && expected_amount_raw !== ""
      ? Number(expected_amount_raw)
      : null;

  if (!drawer_id || !(opening_amount >= 0)) {
    return { ok: false, error: "Preencha caixa e valor de abertura." };
  }

  const { error } = await supabase.from("cash_sessions").insert({
    drawer_id,
    work_date: todayISO(),
    opened_by: user.id,
    opening_amount,
    opening_breakdown,
    expected_amount,
    notes,
    status: "open",
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Já existe uma sessão aberta nesse caixa." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/caixa");
  revalidatePath("/");
  redirect("/caixa");
}

export async function closeSession(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") || "");
  const closing_amount = Number(formData.get("closing_amount") || 0);
  const closing_breakdown = parseBreakdown(formData.get("closing_breakdown"));
  const notes = String(formData.get("notes") || "").trim() || null;
  const expected_amount_raw = formData.get("expected_amount");
  const expected_amount =
    typeof expected_amount_raw === "string" && expected_amount_raw !== ""
      ? Number(expected_amount_raw)
      : null;

  if (!id || !(closing_amount >= 0)) {
    return { ok: false, error: "Preencha o valor de fechamento." };
  }

  const update: Record<string, unknown> = {
    closed_at: new Date().toISOString(),
    closed_by: user.id,
    closing_amount,
    closing_breakdown,
    status: "closed",
  };
  if (expected_amount !== null) update.expected_amount = expected_amount;
  if (notes !== null) update.notes = notes;

  const { error } = await supabase
    .from("cash_sessions")
    .update(update)
    .eq("id", id)
    .eq("status", "open");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/caixa");
  revalidatePath("/");
  redirect("/caixa");
}

export async function reopenSession(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  // Confere se existe outra sessão aberta no mesmo caixa
  const { data: target } = await supabase
    .from("cash_sessions")
    .select("drawer_id")
    .eq("id", id)
    .single();
  if (!target) return { ok: false, error: "Sessão não encontrada" };

  const { data: open } = await supabase
    .from("cash_sessions")
    .select("id")
    .eq("drawer_id", target.drawer_id)
    .eq("status", "open")
    .maybeSingle();
  if (open) return { ok: false, error: "Já existe uma sessão aberta nesse caixa." };

  const { error } = await supabase
    .from("cash_sessions")
    .update({
      closed_at: null,
      closed_by: null,
      closing_amount: null,
      closing_breakdown: null,
      status: "open",
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/caixa");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteSession(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase.from("cash_sessions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/caixa");
  revalidatePath("/");
  return { ok: true };
}
