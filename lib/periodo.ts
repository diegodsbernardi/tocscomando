/**
 * Filtro de período compartilhado (motoboys, extras, freelas x faturamento).
 *
 * Todas as telas de relatório leem os mesmos search params:
 *   ?p=hoje|ontem|7d|semana|semana-1|mes|mes-1|30d|custom
 *   ?de=YYYY-MM-DD&ate=YYYY-MM-DD   (usados quando p=custom)
 *
 * `start` e `end` são SEMPRE inclusivos — quem precisar de fim exclusivo usa
 * `endExclusive`. Datas no fuso do restaurante (lib/dates.ts).
 */
import { todayISO } from "./dates";
import { startOfTuesdayWeek, endOfTuesdayWeek } from "./week";

export type PeriodoKey =
  | "hoje"
  | "ontem"
  | "7d"
  | "semana"
  | "semana-1"
  | "mes"
  | "mes-1"
  | "30d"
  | "custom";

export type Periodo = {
  key: PeriodoKey;
  start: string;
  end: string; // inclusivo
  endExclusive: string;
  label: string; // ex: "18/08 → 23/08"
  titulo: string; // ex: "ÚLTIMOS 7 DIAS"
  dias: number;
};

const PRESET_LABELS: Record<Exclude<PeriodoKey, "custom">, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7d": "7 dias",
  semana: "Semana",
  "semana-1": "Sem. passada",
  mes: "Mês",
  "mes-1": "Mês passado",
  "30d": "30 dias",
};

export const PRESETS = Object.entries(PRESET_LABELS) as [
  Exclude<PeriodoKey, "custom">,
  string,
][];

export function shiftDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dd = new Date(y, m - 1, d);
  dd.setDate(dd.getDate() + delta);
  return isoOf(dd);
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function shiftMonths(iso: string, delta: number): { start: string; end: string } {
  const [y, m] = iso.split("-").map(Number);
  const first = new Date(y, m - 1 + delta, 1);
  const last = new Date(y, m + delta, 0);
  return { start: isoOf(first), end: isoOf(last) };
}

function ehDataISO(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function diasEntre(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

/** Lista as datas ISO do período, do início ao fim (inclusivo). */
export function listarDias(p: Periodo): string[] {
  const out: string[] = [];
  let cur = p.start;
  while (cur <= p.end) {
    out.push(cur);
    cur = shiftDays(cur, 1);
  }
  return out;
}

export function fmtDiaCurto(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function mesExtenso(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m - 1, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .toUpperCase();
}

/**
 * Resolve o período a partir dos search params. Cai em "semana" quando o
 * parâmetro é desconhecido, e em "custom" inválido volta pros últimos 7 dias.
 */
export function resolverPeriodo(params: {
  p?: string;
  de?: string;
  ate?: string;
}): Periodo {
  const hoje = todayISO();
  const key = (params.p || "semana") as PeriodoKey;

  const monta = (start: string, end: string, titulo: string, k: PeriodoKey): Periodo => {
    // Nunca deixa o intervalo invertido.
    const [s, e] = start <= end ? [start, end] : [end, start];
    return {
      key: k,
      start: s,
      end: e,
      endExclusive: shiftDays(e, 1),
      label: `${fmtDiaCurto(s)} → ${fmtDiaCurto(e)}`,
      titulo,
      dias: diasEntre(s, e),
    };
  };

  switch (key) {
    case "hoje":
      return monta(hoje, hoje, "HOJE", key);
    case "ontem": {
      const o = shiftDays(hoje, -1);
      return monta(o, o, "ONTEM", key);
    }
    case "7d":
      return monta(shiftDays(hoje, -6), hoje, "ÚLTIMOS 7 DIAS", key);
    case "30d":
      return monta(shiftDays(hoje, -29), hoje, "ÚLTIMOS 30 DIAS", key);
    case "semana-1": {
      const base = shiftDays(hoje, -7);
      return monta(
        startOfTuesdayWeek(base),
        endOfTuesdayWeek(base),
        "SEMANA PASSADA (TER→SEG)",
        key,
      );
    }
    case "mes": {
      const r = shiftMonths(hoje, 0);
      return monta(r.start, hoje < r.end ? hoje : r.end, mesExtenso(hoje), key);
    }
    case "mes-1": {
      const r = shiftMonths(hoje, -1);
      return monta(r.start, r.end, mesExtenso(r.start), key);
    }
    case "custom": {
      if (ehDataISO(params.de) && ehDataISO(params.ate)) {
        return monta(params.de, params.ate, "PERÍODO ESCOLHIDO", key);
      }
      if (ehDataISO(params.de)) {
        return monta(params.de, hoje, "PERÍODO ESCOLHIDO", key);
      }
      return monta(shiftDays(hoje, -6), hoje, "ÚLTIMOS 7 DIAS", "7d");
    }
    case "semana":
    default:
      return monta(
        startOfTuesdayWeek(hoje),
        endOfTuesdayWeek(hoje),
        "SEMANA (TER→SEG)",
        "semana",
      );
  }
}

/** Monta a querystring do período preservando filtros extras da tela. */
export function qsPeriodo(
  p: Periodo,
  extras: Record<string, string | undefined> = {},
): string {
  const sp = new URLSearchParams();
  sp.set("p", p.key);
  if (p.key === "custom") {
    sp.set("de", p.start);
    sp.set("ate", p.end);
  }
  for (const [k, v] of Object.entries(extras)) if (v) sp.set(k, v);
  return `?${sp.toString()}`;
}
