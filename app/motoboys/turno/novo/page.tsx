import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewShiftForm } from "@/components/NewShiftForm";
import { createShift } from "../../actions";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";

export const dynamic = "force-dynamic";

export default async function NovoTurnoPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: motoboys } = await supabase
    .from("motoboys")
    .select("id, name")
    .eq("active", true)
    .order("name");

  return (
    <Shell>
      <TopBar title="Novo turno" subtitle="motoboy + chegada" backHref="/motoboys" />
      <div className="mt-2 px-4">
        <NewShiftForm motoboys={(motoboys || []) as { id: string; name: string }[]} action={createShift} />
      </div>
    </Shell>
  );
}
