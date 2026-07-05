"use server";

import { revalidatePath } from "next/cache";
import { todayISO as spToday } from "@/lib/dates";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function todayISO() {
  return spToday();
}

// ---------- TURNO ----------
export async function createShift(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const motoboy_id = String(formData.get("motoboy_id") || "");
  const work_date = String(formData.get("work_date") || todayISO());
  const arrival_time = String(formData.get("arrival_time") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!motoboy_id) return { ok: false, error: "Selecione um motoboy." };

  const { data, error } = await supabase
    .from("motoboy_shifts")
    .insert({
      motoboy_id,
      work_date,
      arrival_time,
      notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Esse motoboy já tem turno aberto nessa data." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/motoboys");
  revalidatePath("/");
  redirect(`/motoboys/turno/${data!.id}`);
}

/**
 * @deprecated Use saveShiftRides (batch) — esta versão dispara 1 request por bairro
 * e causa race conditions quando o usuário digita rápido. Mantida só pra compat.
 */
export async function updateShiftRide(shiftId: string, areaId: string, ridesCount: number) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  if (!Number.isFinite(ridesCount) || ridesCount < 0) {
    return { ok: false, error: "Quantidade inválida" };
  }

  if (ridesCount === 0) {
    // Remove se existir
    await supabase
      .from("motoboy_shift_rides")
      .delete()
      .eq("shift_id", shiftId)
      .eq("area_id", areaId);
    revalidatePath("/motoboys");
    return { ok: true };
  }

  // Busca a taxa atual do bairro pra gravar como snapshot
  const { data: area } = await supabase
    .from("delivery_areas")
    .select("fee")
    .eq("id", areaId)
    .single();
  if (!area) return { ok: false, error: "Bairro não encontrado" };

  const { error } = await supabase
    .from("motoboy_shift_rides")
    .upsert(
      {
        shift_id: shiftId,
        area_id: areaId,
        rides_count: ridesCount,
        fee_at_time: Number(area.fee),
      },
      { onConflict: "shift_id,area_id" },
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/motoboys");
  revalidatePath(`/motoboys/turno/${shiftId}`);
  revalidatePath("/");
  return { ok: true };
}

/**
 * Salva TODAS as corridas do turno num único batch.
 * - bairros com count > 0 viram upsert (rides_count, fee_at_time atual)
 * - bairros com count = 0 são deletados (se existirem)
 *
 * Substitui a versão por-bairro (updateShiftRide) — sem race conditions,
 * sem F5 obrigatório (revalida turno + motoboys + home + fechar-o-dia).
 */
export async function saveShiftRides(
  shiftId: string,
  rides: Record<string, number>,
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  // Sanitiza: aceita só números inteiros >= 0
  const sanitized = new Map<string, number>();
  for (const [areaId, count] of Object.entries(rides)) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    sanitized.set(areaId, n);
  }
  if (sanitized.size === 0) return { ok: true };

  // Pega taxas atuais de todos os bairros mencionados
  const areaIds = Array.from(sanitized.keys());
  const { data: areasRows, error: areasErr } = await supabase
    .from("delivery_areas")
    .select("id, fee")
    .in("id", areaIds);
  if (areasErr) return { ok: false, error: areasErr.message };

  const feeById = new Map<string, number>();
  for (const r of areasRows || []) {
    feeById.set(r.id, Number(r.fee));
  }

  // Separa upserts (count > 0) e deletes (count == 0)
  const upserts: { shift_id: string; area_id: string; rides_count: number; fee_at_time: number }[] = [];
  const deletes: string[] = [];
  for (const [areaId, count] of sanitized) {
    if (count > 0) {
      const fee = feeById.get(areaId);
      if (fee == null) continue; // bairro não existe → ignora silenciosamente
      upserts.push({
        shift_id: shiftId,
        area_id: areaId,
        rides_count: count,
        fee_at_time: fee,
      });
    } else {
      deletes.push(areaId);
    }
  }

  if (upserts.length > 0) {
    const { error } = await supabase
      .from("motoboy_shift_rides")
      .upsert(upserts, { onConflict: "shift_id,area_id" });
    if (error) return { ok: false, error: error.message };
  }

  if (deletes.length > 0) {
    const { error } = await supabase
      .from("motoboy_shift_rides")
      .delete()
      .eq("shift_id", shiftId)
      .in("area_id", deletes);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/motoboys/turno/${shiftId}`);
  revalidatePath("/motoboys");
  revalidatePath("/motoboys/historico");
  revalidatePath("/fechar-o-dia");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteShift(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase.from("motoboy_shifts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/motoboys");
  revalidatePath("/");
  return { ok: true };
}

export async function closeWeek(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const week_start = String(formData.get("week_start") || "");
  const week_end = String(formData.get("week_end") || "");
  if (!week_start || !week_end) return { ok: false, error: "Datas inválidas" };

  const { error } = await supabase
    .from("motoboy_shifts")
    .update({
      paid: true,
      paid_at: new Date().toISOString(),
      paid_by: user.id,
    })
    .gte("work_date", week_start)
    .lte("work_date", week_end)
    .eq("paid", false);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/motoboys");
  revalidatePath("/");
  return { ok: true };
}

// ---------- CADASTROS ----------
export async function createMotoboy(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  if (!name) return { ok: false, error: "Nome obrigatório." };

  const { error } = await supabase.from("motoboys").insert({ name, phone });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Motoboy já cadastrado." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/motoboys/cadastro");
  revalidatePath("/motoboys");
  return { ok: true };
}

export async function updateMotoboy(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  if (!id || !name) return { ok: false, error: "Dados incompletos." };

  const { error } = await supabase.from("motoboys").update({ name, phone }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/motoboys/cadastro");
  revalidatePath("/motoboys");
  return { ok: true };
}

export async function toggleMotoboyActive(id: string, active: boolean) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase.from("motoboys").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/motoboys/cadastro");
  revalidatePath("/motoboys");
  return { ok: true };
}

// ---------- BAIRROS ----------
export async function createArea(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const name = String(formData.get("name") || "").trim();
  const fee = Number(formData.get("fee") || 0);
  if (!name) return { ok: false, error: "Nome obrigatório." };
  if (!(fee > 0)) return { ok: false, error: "Taxa precisa ser > 0." };

  const { error } = await supabase.from("delivery_areas").insert({ name, fee });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Bairro já cadastrado." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/motoboys/bairros");
  return { ok: true };
}

export async function updateAreaFee(id: string, fee: number) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };
  if (!(fee > 0)) return { ok: false, error: "Taxa precisa ser > 0." };

  const { error } = await supabase.from("delivery_areas").update({ fee }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/motoboys/bairros");
  return { ok: true };
}

export async function toggleAreaActive(id: string, active: boolean) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase.from("delivery_areas").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/motoboys/bairros");
  return { ok: true };
}
