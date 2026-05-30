import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShiftRideEditor } from "@/components/ShiftRideEditor";
import { DeleteShiftButton } from "@/components/MotoboyShiftActions";
import { formatDateBR } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function TurnoDetalhePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: shift }, { data: areas }, { data: rides }] = await Promise.all([
    supabase
      .from("motoboy_shifts")
      .select("id, work_date, arrival_time, paid, paid_at, notes, motoboys(id, name, phone)")
      .eq("id", params.id)
      .single(),
    supabase
      .from("delivery_areas")
      .select("id, name, fee")
      .eq("active", true)
      .order("fee")
      .order("name"),
    supabase
      .from("motoboy_shift_rides")
      .select("area_id, rides_count, fee_at_time")
      .eq("shift_id", params.id),
  ]);

  if (!shift) notFound();

  const motoboy = (shift as unknown as {
    motoboys: { id: string; name: string; phone: string | null } | null;
  }).motoboys;

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900">{motoboy?.name ?? "—"}</h1>
          <p className="text-xs text-slate-500">
            {formatDateBR(shift.work_date, { weekday: "long", day: "2-digit", month: "long" })}
            {shift.arrival_time && ` · chegou ${String(shift.arrival_time).slice(0, 5)}`}
          </p>
          {motoboy?.phone && (
            <a
              href={`tel:${motoboy.phone.replace(/\D/g, "")}`}
              className="mt-1 inline-block text-xs font-semibold text-brand-dark underline"
            >
              {motoboy.phone}
            </a>
          )}
          {shift.paid && (
            <p className="mt-1 inline-block rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              Pago
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <DeleteShiftButton id={shift.id} />
          <Link
            href="/motoboys"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Voltar
          </Link>
        </div>
      </header>

      <ShiftRideEditor
        shiftId={shift.id}
        areas={(areas || []).map((a) => ({ id: a.id, name: a.name, fee: Number(a.fee) }))}
        initialRides={(rides || []).map((r) => ({
          area_id: r.area_id,
          rides_count: Number(r.rides_count),
          fee_at_time: Number(r.fee_at_time),
        }))}
      />
    </main>
  );
}
