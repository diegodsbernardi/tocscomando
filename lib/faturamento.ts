/**
 * Faturamento por dia, com duas fontes:
 *   1. saipos_snapshots — verdade do PDV; soma o snapshot MAIS RECENTE de cada
 *      loja naquele work_date.
 *   2. reports (fechamento de caixa) — fallback pros dias anteriores à captura
 *      Saipos entrar no ar.
 *
 * Quem consome recebe também a origem, pra tela poder avisar quando o número
 * veio do caixa e não do PDV.
 */
import { createClient } from "@/lib/supabase/server";
import { toSPDate } from "./dates";

export type FaturamentoDia = {
  date: string;
  total: number;
  fonte: "saipos" | "caixa" | "sem-dado";
};

export async function getFaturamentoPorDia(
  start: string,
  endExclusive: string,
): Promise<Map<string, FaturamentoDia>> {
  const supabase = createClient();

  const [{ data: saiposRaw }, { data: reportsRaw }] = await Promise.all([
    supabase
      .from("saipos_snapshots")
      .select("work_date, drawer_name, total_sales, captured_at")
      .gte("work_date", start)
      .lt("work_date", endExclusive)
      .order("captured_at", { ascending: false }),
    supabase
      .from("reports")
      .select("total, created_at")
      .gte("created_at", `${start}T00:00:00-03:00`)
      .lt("created_at", `${endExclusive}T00:00:00-03:00`),
  ]);

  // Saipos: último snapshot por (dia, loja) — rows já vêm do mais recente.
  const vistos = new Set<string>();
  const porDiaSaipos = new Map<string, number>();
  for (const s of (saiposRaw || []) as {
    work_date: string;
    drawer_name: string | null;
    total_sales: number | string | null;
  }[]) {
    const chave = `${s.work_date}|${s.drawer_name ?? "consolidado"}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    porDiaSaipos.set(
      s.work_date,
      (porDiaSaipos.get(s.work_date) ?? 0) + (Number(s.total_sales) || 0),
    );
  }

  const porDiaCaixa = new Map<string, number>();
  for (const r of (reportsRaw || []) as { total: number | string; created_at: string }[]) {
    const iso = toSPDate(r.created_at);
    porDiaCaixa.set(iso, (porDiaCaixa.get(iso) ?? 0) + (Number(r.total) || 0));
  }

  const out = new Map<string, FaturamentoDia>();
  const dias = new Set([...porDiaSaipos.keys(), ...porDiaCaixa.keys()]);
  for (const dia of dias) {
    const saipos = porDiaSaipos.get(dia) ?? 0;
    if (saipos > 0) {
      out.set(dia, { date: dia, total: saipos, fonte: "saipos" });
      continue;
    }
    const caixa = porDiaCaixa.get(dia) ?? 0;
    out.set(dia, {
      date: dia,
      total: caixa,
      fonte: caixa > 0 ? "caixa" : "sem-dado",
    });
  }
  return out;
}
