import { createClient } from "@/lib/supabase/server";
import { startOfDayISO as spStartOfDay } from "@/lib/dates";
import { getAuthUser } from "@/lib/profile";
import { brl } from "@/lib/format";

function startOfDayISO() {
  return spStartOfDay();
}

export async function QuickStats() {
  const supabase = createClient();
  const user = await getAuthUser();
  if (!user) return null;

  const { data } = await supabase
    .from("reports")
    .select("total")
    .gte("created_at", startOfDayISO());

  const list = data || [];
  const count = list.length;
  const total = list.reduce((a, r) => a + Number(r.total), 0);
  const avg = count > 0 ? total / count : 0;

  return (
    <section
      aria-label="Estatísticas rápidas"
      className="reveal d3 mx-4 mt-4 flex gap-3"
    >
      <Stat
        label="Cupons hoje"
        value={String(count)}
        icon={<IconReceipt />}
        iconBg="#E6F6FF"
        iconColor="text-cyan"
      />
      <Stat
        label="Ticket médio"
        value={brl(avg)}
        icon={<IconDollar />}
        iconBg="#FFF7CC"
        iconColor="text-brandyellow-deep"
      />
    </section>
  );
}

function Stat({
  label,
  value,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="flex-1 rounded-card bg-white px-4 py-[14px] shadow-card">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
        <span
          className={`grid h-[26px] w-[26px] flex-shrink-0 place-items-center rounded-[9px] ${iconColor}`}
          style={{ backgroundColor: iconBg }}
        >
          <span className="block h-3.5 w-3.5">{icon}</span>
        </span>
        {label}
      </div>
      <div className="mt-1 font-display text-[22px] font-bold leading-none tracking-[-0.5px] tabular-nums">
        {value}
      </div>
    </div>
  );
}

function IconReceipt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z" />
      <line x1="8" y1="8" x2="14" y2="8" />
      <line x1="8" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function IconDollar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
