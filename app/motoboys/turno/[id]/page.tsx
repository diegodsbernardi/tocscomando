import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShiftRideEditor } from "@/components/ShiftRideEditor";
import { DeleteShiftButton } from "@/components/MotoboyShiftActions";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
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

  const subtitle = `${formatDateBR(shift.work_date, { weekday: "short", day: "2-digit", month: "short" })}${
    shift.arrival_time ? ` · chegou ${String(shift.arrival_time).slice(0, 5)}` : ""
  }`;

  return (
    <Shell>
      <TopBar
        title={motoboy?.name ?? "Turno"}
        subtitle={subtitle}
        backHref="/motoboys"
        rightSlot={<DeleteShiftButton id={shift.id} />}
      />
      <div className="mt-2 px-4">
        {motoboy?.phone && (
          <a
            href={`tel:${motoboy.phone.replace(/\D/g, "")}`}
            className="mb-3 inline-block text-xs font-bold text-cyan underline"
          >
            📞 {motoboy.phone}
          </a>
        )}
        {shift.paid && (
          <p className="mb-3 inline-block rounded bg-ok-bg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ok">
            Pago
          </p>
        )}
        <ShiftRideEditor
          shiftId={shift.id}
          areas={(areas || []).map((a) => ({ id: a.id, name: a.name, fee: Number(a.fee) }))}
          initialRides={(rides || []).map((r) => ({
            area_id: r.area_id,
            rides_count: Number(r.rides_count),
            fee_at_time: Number(r.fee_at_time),
          }))}
        />
      </div>
    </Shell>
  );
}
