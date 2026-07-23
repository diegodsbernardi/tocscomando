"use server";

import { revalidatePath } from "next/cache";
import { todayISO as spToday } from "@/lib/dates";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";

function todayISO() {
  return spToday();
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

  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return { ok: false, error: "Só o admin pode apagar sessões." };
  }

  const { error } = await supabase.from("cash_sessions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/caixa");
  revalidatePath("/");
  return { ok: true };
}

// ---------- MOVIMENTAÇÕES ----------
export async function addMovement(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const session_id = String(formData.get("session_id") || "");
  const direction = String(formData.get("direction") || "");
  const category = String(formData.get("category") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const note = String(formData.get("note") || "").trim() || null;

  if (!session_id) return { ok: false, error: "Sessão inválida." };
  if (direction !== "in" && direction !== "out") return { ok: false, error: "Direção inválida." };
  if (!category) return { ok: false, error: "Escolha uma categoria." };
  if (!(amount > 0)) return { ok: false, error: "Valor precisa ser maior que zero." };
  if (category === "Outros" && !note) {
    return { ok: false, error: "Em 'Outros' o motivo é obrigatório." };
  }

  const { error } = await supabase.from("cash_movements").insert({
    session_id,
    direction,
    category,
    amount,
    note,
    created_by: user.id,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/caixa");
  revalidatePath(`/caixa/fechar/${session_id}`);
  revalidatePath("/fechar-o-dia");
  return { ok: true };
}

export async function deleteMovement(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  // Pega session_id antes do delete pra revalidar a rota correta
  const { data: mov } = await supabase
    .from("cash_movements")
    .select("session_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("cash_movements").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/caixa");
  if (mov?.session_id) {
    revalidatePath(`/caixa/fechar/${mov.session_id}`);
  }
  revalidatePath("/fechar-o-dia");
  return { ok: true };
}
