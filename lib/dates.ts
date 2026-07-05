/**
 * Datas no fuso do restaurante (America/Sao_Paulo).
 *
 * O server (Vercel/Actions) roda em UTC — depois das ~21h BRT, `new Date()`
 * local já é "amanhã". TODO código server que fala de "hoje/este mês" deve
 * usar estes helpers, nunca getFullYear()/getMonth()/getDate() diretos.
 *
 * Obs: Brasil não tem horário de verão desde 2019 — offset fixo -03:00.
 */

const TZ = "America/Sao_Paulo";

/** Data de hoje em SP no formato YYYY-MM-DD. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Instante UTC (ISO) da meia-noite de hoje em SP — pra filtrar timestamptz. */
export function startOfDayISO(): string {
  return new Date(`${todayISO()}T00:00:00-03:00`).toISOString();
}

/** Mês corrente em SP no formato YYYY-MM. */
export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

/** Converte um timestamp (ISO/Date) para a data YYYY-MM-DD em SP. */
export function toSPDate(ts: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(ts));
}
