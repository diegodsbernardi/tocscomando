import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { currentMonth } from "@/lib/dates";

/**
 * Sangrias por destino no mês corrente.
 *
 * O destino é gravado pelo CashMovementForm como prefixo "[Cofre]" / "[Banco]" /
 * "[Pagamento]" / "[Outro]" no `note` de `cash_movements` (sem coluna própria).
 * Movimentos antigos (sem prefixo) caem em "Sem destino".
 * "Troco p/ outro caixa" não é sangria — fica de fora.
 */

export type SangriaDestino = {
  destino: string;
  total: number;
  count: number;
};

export type SangriaData = {
  destinos: SangriaDestino[];
  total: number;
  /** Saídas operacionais do mês (vale/consumo/perda) — não são sangria */
  operacionais: SangriaDestino[];
  error: boolean;
};

// Saídas que não são sangria: dinheiro que "sai" por rotina da operação
const CATEGORIAS_OPERACIONAIS = ["Vale / adiantamento", "Consumo interno", "Perda / desperdício"];

const PREFIX_RE = /^\[([^\]]{1,30})\]/;

export const getSangriaDestinos = cache(async (): Promise<SangriaData> => {
  const supabase = createClient();
  const month = currentMonth(); // YYYY-MM
  const [y, m] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const nextMonth =
    m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  // Sem embed cash_movements→cash_sessions: o schema cache do PostgREST não
  // expõe essa FK (dá PGRST200). Duas queries: sessões do mês → movimentos.
  const { data: sessions, error: sessErr } = await supabase
    .from("cash_sessions")
    .select("id")
    .gte("work_date", monthStart)
    .lt("work_date", nextMonth);

  if (sessErr) return { destinos: [], total: 0, operacionais: [], error: true };
  const sessionIds = (sessions || []).map((s) => s.id as string);
  if (sessionIds.length === 0) return { destinos: [], total: 0, operacionais: [], error: false };

  const { data, error } = await supabase
    .from("cash_movements")
    .select("amount, note, category")
    .eq("direction", "out")
    .neq("category", "Troco p/ outro caixa")
    .in("session_id", sessionIds);

  if (error) return { destinos: [], total: 0, operacionais: [], error: true };

  const byDestino = new Map<string, { total: number; count: number }>();
  const byCategoria = new Map<string, { total: number; count: number }>();
  let total = 0;
  for (const mov of data || []) {
    const amount = Number(mov.amount) || 0;
    if (CATEGORIAS_OPERACIONAIS.includes(mov.category || "")) {
      const acc = byCategoria.get(mov.category) || { total: 0, count: 0 };
      acc.total += amount;
      acc.count += 1;
      byCategoria.set(mov.category, acc);
      continue; // não entra na soma de sangrias
    }
    const match = (mov.note || "").match(PREFIX_RE);
    const destino = match ? match[1] : "Sem destino";
    const acc = byDestino.get(destino) || { total: 0, count: 0 };
    acc.total += amount;
    acc.count += 1;
    byDestino.set(destino, acc);
    total += amount;
  }

  const destinos = Array.from(byDestino.entries())
    .map(([destino, v]) => ({ destino, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);

  const operacionais = Array.from(byCategoria.entries())
    .map(([destino, v]) => ({ destino, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);

  return { destinos, total, operacionais, error: false };
});
