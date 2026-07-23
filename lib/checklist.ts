import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";

/**
 * Checklist do turno (v1: itens fixos em código — Diego ajusta os textos aqui).
 * Checks do dia ficam em day_checklist (PK work_date+item_key).
 */

export type ChecklistItem = { key: string; label: string };

export const CHECKLIST_ABERTURA: ChecklistItem[] = [
  { key: "ab_chapa", label: "Ligar chapa e fritadeira" },
  { key: "ab_gas", label: "Conferir gás" },
  { key: "ab_troco", label: "Contar troco e abrir o caixa no app" },
  { key: "ab_praca", label: "Praça limpa e reposição feita" },
];

export const CHECKLIST_FECHAMENTO: ChecklistItem[] = [
  { key: "fe_equip", label: "Desligar chapa, fritadeira e exaustor" },
  { key: "fe_perec", label: "Guardar perecíveis na câmara" },
  { key: "fe_lixo", label: "Tirar o lixo e limpar a praça" },
  { key: "fe_trancar", label: "Conferir portas e trancar a loja" },
];

export type DayCheck = {
  item_key: string;
  done_by_name: string | null;
  done_at: string;
};

export type ChecklistState = {
  checks: Map<string, DayCheck>;
  aberturaDone: number;
  fechamentoDone: number;
  error: boolean;
};

export const getTodayChecklist = cache(async (): Promise<ChecklistState> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("day_checklist")
    .select("item_key, done_by_name, done_at")
    .eq("work_date", todayISO());

  if (error) return { checks: new Map(), aberturaDone: 0, fechamentoDone: 0, error: true };

  const checks = new Map<string, DayCheck>();
  for (const c of (data || []) as DayCheck[]) checks.set(c.item_key, c);

  return {
    checks,
    aberturaDone: CHECKLIST_ABERTURA.filter((i) => checks.has(i.key)).length,
    fechamentoDone: CHECKLIST_FECHAMENTO.filter((i) => checks.has(i.key)).length,
    error: false,
  };
});
