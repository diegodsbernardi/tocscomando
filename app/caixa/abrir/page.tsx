import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { CashOpenForm } from "@/components/CashOpenForm";
import { openSession } from "../actions";

export const dynamic = "force-dynamic";

type Drawer = { id: string; name: string };

const DRAWER_LABEL: Record<string, string> = {
  DLV: "Delivery",
  LTDA: "Salão",
};

export default async function AbrirCaixaPage({
  searchParams,
}: {
  searchParams: { drawer?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: drawers } = await supabase
    .from("cash_drawers")
    .select("id, name")
    .eq("active", true)
    .order("name");
  const list = (drawers || []) as Drawer[];
  const preselected =
    searchParams.drawer && list.find((d) => d.id === searchParams.drawer)
      ? searchParams.drawer
      : list[0]?.id || "";
  const selected = list.find((d) => d.id === preselected);
  const subtitle = selected ? DRAWER_LABEL[selected.name] || selected.name : "";

  return (
    <Shell>
      <TopBar title="Abrir caixa" subtitle={subtitle} backHref="/caixa" />
      <div className="mt-2 px-4">
        <CashOpenForm
          drawers={list.map((d) => ({ id: d.id, name: DRAWER_LABEL[d.name] || d.name }))}
          preselectedDrawerId={preselected}
          action={openSession}
        />
      </div>
    </Shell>
  );
}
