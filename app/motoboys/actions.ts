"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const MIN_DAILY_PAYMENT = 100;

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
