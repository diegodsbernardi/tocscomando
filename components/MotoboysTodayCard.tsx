import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/week";
import { MIN_DAILY_PAYMENT } from "@/lib/motoboys";

type Ride = { rides_count: number; fee_at_time: number };
type Shift = { id: string; motoboys: { name: string } | null; motoboy_shift_rides: Ride[] };

function brl(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function MotoboysTodayCard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = todayISO();
  const { data } = await supabase
    .from("motoboy_shifts")
    .select("id, motoboys(name), motoboy_shift_rides(rides_count, fee_at_time)")
    .eq("work_date", today);

  const shifts = (data || []) as unknown as Shift[];

  let totalRides = 0;
  let totalDue = 0;
  for (const s of shifts) {
    const raw = s.motoboy_shift_rides.reduce(
      (acc, r) => acc + Number(r.rides_count) * Number(r.fee_at_time),
      0,
    );
    const rides = s.motoboy_shift_rides.reduce((acc, r) => acc + Number(r.rides_count), 0);
    totalRides += rides;
    totalDue += Math.max(raw, MIN_DAILY_PAYMENT);
  }

  return (
    <Link
      href="/motoboys"
      aria-label="Ver motoboys"
      className="block rounded-2xl bg-white p-5 shadow transition hover:shadow-md"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          Delivery hoje
        </span>
        <span className="text-xs text-muted">ver →</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Motoboys
          </p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-navy">{shifts.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Corridas
          </p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-navy">{totalRides}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Total
          </p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-navy">{brl(totalDue)}</p>
        </div>
      </div>
    </Link>
  );
}
