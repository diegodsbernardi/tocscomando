import { MIN_DAILY_PAYMENT } from "./motoboys";

export type RawShift = {
  id: string;
  work_date: string;
  motoboy_id: string;
  motoboys: { name: string } | null;
  rides: { rides_count: number; fee_at_time: number }[];
};

export type ShiftStats = {
  shiftId: string;
  motoboyId: string;
  motoboyName: string;
  workDate: string;
  rides: number;
  raw: number;
  effective: number;
  floored: boolean;
};

export type AggregateStats = {
  totalRides: number;
  totalMotos: number; // motoboys distintos no período
  totalPago: number;
  totalPiso: number; // quanto foi completado pra atingir o piso (R$100)
  ridesPerMoto: number;
  custoPorCorrida: number;
};

export function statsFromShift(s: RawShift): ShiftStats {
  const rides = s.rides.reduce((a, r) => a + Number(r.rides_count), 0);
  const raw = s.rides.reduce(
    (a, r) => a + Number(r.rides_count) * Number(r.fee_at_time),
    0,
  );
  const effective = Math.max(raw, MIN_DAILY_PAYMENT);
  return {
    shiftId: s.id,
    motoboyId: s.motoboy_id,
    motoboyName: s.motoboys?.name || "—",
    workDate: s.work_date,
    rides,
    raw,
    effective,
    floored: raw < MIN_DAILY_PAYMENT,
  };
}

export function aggregate(shifts: ShiftStats[]): AggregateStats {
  const totalRides = shifts.reduce((a, s) => a + s.rides, 0);
  const totalPago = shifts.reduce((a, s) => a + s.effective, 0);
  const totalRaw = shifts.reduce((a, s) => a + s.raw, 0);
  const totalPiso = totalPago - totalRaw;
  const totalMotos = new Set(shifts.map((s) => s.motoboyId)).size;
  return {
    totalRides,
    totalMotos,
    totalPago,
    totalPiso,
    ridesPerMoto: totalMotos > 0 ? totalRides / totalMotos : 0,
    custoPorCorrida: totalRides > 0 ? totalPago / totalRides : 0,
  };
}

export type Verdict = {
  tone: "ok" | "warn";
  text: string;
};

/**
 * Heurística rasa para sinalizar dimensionamento da escala:
 *  - muitas corridas por moto + pouco piso = motos sobrecarregados
 *  - poucas corridas por moto + muito piso = motos sobrando
 *  - meio termo = ok
 */
export function verdictFor(agg: AggregateStats, scope: "dia" | "semana" | "mes"): Verdict {
  const { totalMotos, totalRides, totalPago, totalPiso, ridesPerMoto } = agg;

  if (totalMotos === 0 || totalRides === 0) {
    return {
      tone: "ok",
      text: "Sem turnos lançados no período. Quando a noite virar, lança os turnos pra ver a análise.",
    };
  }

  const pisoPct = totalPago > 0 ? totalPiso / totalPago : 0;

  // Cenário "sobrando moto"
  if (pisoPct >= 0.25 && ridesPerMoto <= 8) {
    return {
      tone: "warn",
      text: `${totalMotos} motos pra ${totalRides} corridas (~${ridesPerMoto.toFixed(1)}/moto). ${(pisoPct * 100).toFixed(0)}% do pago foi piso — moto sobrando. Vale segurar alguém da escala.`,
    };
  }

  // Cenário "faltando moto"
  if (pisoPct <= 0.05 && ridesPerMoto >= 15) {
    return {
      tone: "warn",
      text: `Cada moto fez ~${ridesPerMoto.toFixed(0)} corridas e quase ninguém ficou no piso. Tá no sufoco — escalar +1 ${scope === "semana" ? "nos picos da semana" : scope === "mes" ? "fixo no mês" : "no próximo dia parecido"}.`,
    };
  }

  return {
    tone: "ok",
    text: `${totalMotos} ${totalMotos === 1 ? "moto" : "motos"} pra ${totalRides} corridas (~${ridesPerMoto.toFixed(1)}/moto). Time bem dimensionado — não precisa mexer.`,
  };
}

// ---------- Date helpers ----------
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function monthRange(iso: string): { start: string; end: string } {
  const [y, m] = iso.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = new Date(y, m, 1);
  const end = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

// ---------- Chart bucketing ----------
export type Bucket = { label: string; value: number; peak?: boolean };

const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dowFromISO(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function dateFromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function chartByMotoboy(shifts: ShiftStats[]): Bucket[] {
  // Agrupa por motoboyId
  const byMoto = new Map<string, { name: string; rides: number; floored: boolean }>();
  for (const s of shifts) {
    const cur = byMoto.get(s.motoboyId);
    if (cur) {
      cur.rides += s.rides;
      cur.floored = cur.floored || s.floored;
    } else {
      byMoto.set(s.motoboyId, { name: s.motoboyName, rides: s.rides, floored: s.floored });
    }
  }
  const rows = Array.from(byMoto.values())
    .map((r) => ({ label: firstName(r.name), value: r.rides, floored: r.floored }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  const max = Math.max(...rows.map((r) => r.value), 0);
  return rows.map((r) => ({ label: r.label, value: r.value, peak: r.value === max && max > 0 }));
}

export function chartByDayOfWeek(shifts: ShiftStats[]): Bucket[] {
  // Soma corridas por DoW dentro do range
  const sums = new Array(7).fill(0);
  for (const s of shifts) {
    const dow = dowFromISO(s.workDate);
    sums[dow] += s.rides;
  }
  // Ordem TOCS: ter, qua, qui, sex, sáb, dom, seg (semana operacional)
  const order = [2, 3, 4, 5, 6, 0, 1];
  const max = Math.max(...sums, 0);
  return order.map((d) => ({
    label: DOW_LABELS[d],
    value: sums[d],
    peak: sums[d] === max && max > 0,
  }));
}

export function chartByWeekOfMonth(
  shifts: ShiftStats[],
  monthStart: string,
): Bucket[] {
  // Calcula em qual "semana corrida" (ter–seg) do mês cada shift caiu
  const [y, m] = monthStart.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  // ter-aligned: encontra a terça-feira da semana que contém ou precede dia 1
  const dow = start.getDay(); // 0=dom..6=sáb
  // mondayBased: seg=0..dom=6
  const mondayBased = (dow + 6) % 7;
  // terça = mondayBased 1; voltar até cair em ter
  const delta = (mondayBased - 1 + 7) % 7;
  const firstTue = new Date(start);
  firstTue.setDate(start.getDate() - delta);

  const buckets = new Map<number, number>();
  for (const s of shifts) {
    const sd = dateFromISO(s.workDate);
    const diffDays = Math.floor((sd.getTime() - firstTue.getTime()) / 86400000);
    if (diffDays < 0) continue;
    const week = Math.floor(diffDays / 7) + 1; // Semana 1, 2, 3, ...
    buckets.set(week, (buckets.get(week) ?? 0) + s.rides);
  }
  const weekNumbers = Array.from(buckets.keys()).sort((a, b) => a - b);
  if (weekNumbers.length === 0) {
    return [
      { label: "Sem 1", value: 0 },
      { label: "Sem 2", value: 0 },
      { label: "Sem 3", value: 0 },
      { label: "Sem 4", value: 0 },
    ];
  }
  const max = Math.max(...Array.from(buckets.values()), 0);
  return weekNumbers.map((w) => ({
    label: `Sem ${w}`,
    value: buckets.get(w) ?? 0,
    peak: buckets.get(w) === max && max > 0,
  }));
}

function firstName(full: string): string {
  return full.split(/\s+/)[0] || full;
}
