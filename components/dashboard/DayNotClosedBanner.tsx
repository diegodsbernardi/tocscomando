import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";

/** Ontem em SP (YYYY-MM-DD), derivado de todayISO — nunca de new Date() local. */
function yesterdayISO(): string {
  const d = new Date(`${todayISO()}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** "sex, 05/jul" a partir de YYYY-MM-DD. */
function labelPtBR(iso: string): string {
  const d = new Date(`${iso}T12:00:00-03:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  })
    .format(d)
    .replace(/\./g, "")
    .replace(" de ", "/");
}

/**
 * Aviso na home quando ontem teve movimento (sessão de caixa ou turno de
 * motoboy) mas ninguém concluiu o wizard de fechar o dia (sem day_closures).
 */
export async function DayNotClosedBanner() {
  const supabase = createClient();
  const yesterday = yesterdayISO();

  const [closure, sessions, shifts] = await Promise.all([
    supabase
      .from("day_closures")
      .select("id")
      .eq("work_date", yesterday)
      .limit(1),
    supabase
      .from("cash_sessions")
      .select("id")
      .eq("work_date", yesterday)
      .limit(1),
    supabase
      .from("motoboy_shifts")
      .select("id")
      .eq("work_date", yesterday)
      .limit(1),
  ]);

  // Erro de query ou dia já fechado ou sem movimento: não mostra nada.
  if (closure.error || sessions.error || shifts.error) return null;
  if (closure.data && closure.data.length > 0) return null;
  const hadMovement =
    (sessions.data?.length ?? 0) > 0 || (shifts.data?.length ?? 0) > 0;
  if (!hadMovement) return null;

  return (
    <Link
      href="/fechar-o-dia"
      className="reveal mx-4 mt-3 flex items-center gap-3 rounded-card bg-warn-bg p-4 px-[18px] text-warn shadow-card transition hover:brightness-95"
    >
      <span className="text-xl leading-none" aria-hidden>
        ⚠
      </span>
      <div className="flex-1 min-w-0">
        <strong className="block text-[14px] font-bold">
          Ontem ({labelPtBR(yesterday)}) ficou sem fechar o dia
        </strong>
        <span className="text-xs opacity-80">
          O wizard só fecha o dia corrente — não esqueça de concluir HOJE.
        </span>
      </div>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="flex-shrink-0 opacity-70"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  );
}
