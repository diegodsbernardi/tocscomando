import { createClient } from "@/lib/supabase/server";
import { startOfDayISO as spStartOfDay } from "@/lib/dates";
import { getAuthUser } from "@/lib/profile";
import { brl, brlSplit } from "@/lib/format";
import { getDailyRevenueGoal } from "@/lib/settings";

function startOfDayISO() {
  return spStartOfDay();
}

export async function TodayHero() {
  const supabase = createClient();
  const [user, metaDia] = await Promise.all([getAuthUser(), getDailyRevenueGoal()]);
  if (!user) return null;

  const { data } = await supabase
    .from("reports")
    .select("credito, debito, pix, total")
    .eq("user_id", user.id)
    .gte("created_at", startOfDayISO());

  const list = data || [];
  const totals = list.reduce(
    (acc, r) => {
      acc.credito += Number(r.credito);
      acc.debito += Number(r.debito);
      acc.pix += Number(r.pix);
      acc.total += Number(r.total);
      return acc;
    },
    { credito: 0, debito: 0, pix: 0, total: 0 },
  );

  const split = brlSplit(totals.total);
  const pct = Math.min(100, Math.round((totals.total / metaDia) * 100));

  return (
    <section
      aria-label="Faturamento de hoje"
      className="reveal d2 relative mx-4 mt-3 overflow-hidden rounded-hero p-[22px] pb-[18px] text-white shadow-glow bg-cyan-hero"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-[1.5px] opacity-85">
          FATURAMENTO HOJE
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brandyellow px-2.5 py-1 text-[11px] font-bold text-navy">
          <span className="live-dot h-[7px] w-[7px] rounded-full bg-navy" />
          ao vivo
        </span>
      </div>

      <div className="mt-1.5 font-display text-[44px] font-extrabold leading-none tracking-[-1.5px]">
        {split.int}
        <span className="text-[26px] opacity-80">{split.cents}</span>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs opacity-90">
          <span>Meta do dia · {brl(metaDia)}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-brandyellow transition-[width] duration-1000 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Breakdown label="Crédito" value={totals.credito} icon={<IconCard />} />
        <Breakdown label="Débito" value={totals.debito} icon={<IconCardChip />} />
        <Breakdown label="Pix" value={totals.pix} icon={<IconPix />} />
      </div>
    </section>
  );
}

function Breakdown({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.14] px-3 py-[11px]">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold opacity-85">
        <span className="h-[13px] w-[13px]">{icon}</span>
        {label}
      </div>
      <div className="mt-0.5 text-[15px] font-bold tabular-nums">{brl(value)}</div>
    </div>
  );
}

function IconCard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function IconCardChip() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <circle cx="8" cy="12" r="2.4" />
    </svg>
  );
}

function IconPix() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2 22 12 12 22 2 12z" />
    </svg>
  );
}
