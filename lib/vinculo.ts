import { todayISO as spToday } from "./dates";
// Regras de "vínculo empregatício" — alertam quando uma pessoa
// vem como extra muitas vezes na mesma semana corrida (seg–dom).

export const VINCULO_LIMIT = 3; // 3+ vindas na semana = perigo

export type VinculoLevel = "ok" | "warn" | "danger";

export function levelForCount(count: number): VinculoLevel {
  if (count >= VINCULO_LIMIT) return "danger";
  if (count === VINCULO_LIMIT - 1) return "warn";
  return "ok";
}

/** Início/fim da semana ISO (seg–dom) que contém a data. */
export function isoWeekRange(iso: string): { start: string; end: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  // dow: 0=domingo, 1=segunda, ... 6=sábado. Queremos seg=0..dom=6.
  const mondayBased = (base.getDay() + 6) % 7;
  const start = new Date(base);
  start.setDate(base.getDate() - mondayBased);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}

export function isoToday(): string {
  return spToday();
}
