import { todayISO as spToday } from "./dates";
// Semana operacional do TOCS: começa terça-feira (depois da folga de segunda).
// Funções pra calcular start/end da semana de uma data ISO.

function dowMondayBased(d: Date) {
  // dom=0..sab=6 → seg=0..dom=6
  return (d.getDay() + 6) % 7;
}

export function startOfTuesdayWeek(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  // terça = dow 1 (na escala seg-dom-domingo). Voltamos N dias até cair em terça.
  const mondayBased = dowMondayBased(base); // seg=0
  // queremos terça=1; dias a voltar:
  const delta = (mondayBased - 1 + 7) % 7;
  base.setDate(base.getDate() - delta);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

export function endOfTuesdayWeek(iso: string): string {
  const [y, m, d] = (startOfTuesdayWeek(iso)).split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6); // ter + 6 dias = seg (folga)
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

export function todayISO(): string {
  return spToday();
}

export function formatDateBR(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", opts);
}
